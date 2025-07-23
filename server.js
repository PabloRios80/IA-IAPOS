// 1. Cargar variables de entorno al inicio de todo
require('dotenv').config();

// 2. Importar módulos necesarios
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors'); // Necesario para permitir comunicación entre tu HTML y Node.js

// 3. Configurar la aplicación Express
const app = express();
const port = process.env.PORT || 3000; // Usa el puerto 3000 o el que defina el entorno

// 4. Verificar que la clave de API esté presente
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("Error: La clave de API no está definida en el archivo .env");
    console.error("Asegúrate de que tu archivo .env tenga 'API_KEY=TU_CLAVE_DE_API_AQUI'");
    process.exit(1); // Salir de la aplicación si no hay clave
}

// 5. Inicializar la API de Gemini
const genAI = new GoogleGenerativeAI(API_KEY);
// Puedes elegir entre "gemini-pro" (para texto) o "gemini-1.5-flash" (más rápido, ideal para chat)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 6. Configurar Middlewares de Express
app.use(express.json()); // Habilita el parseo de JSON en el cuerpo de las peticiones
// Configuración de CORS:
// En desarrollo, puedes permitir todos los orígenes.
// Para producción, se recomienda especificar el dominio de tu frontend.
app.use(cors({
    origin: '*', // Permite cualquier origen (solo para desarrollo)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
// Servir archivos estáticos (como tu index.html)
app.use(express.static('public')); // Asume que index.html estará en una carpeta 'public'

// 7. Cargar la base de conocimiento de IAPOS
let iaposKnowledge = [];
try {
    iaposKnowledge = require('./info_dia_preventivo.json');
    console.log(`Base de conocimiento de IAPOS cargada con ${iaposKnowledge.length} ítems.`);
} catch (error) {
    console.error("Error al cargar info_dia_preventivo.json:", error.message);
    console.error("Asegúrate de que el archivo existe y es un JSON válido.");
    process.exit(1); // Salir si no se puede cargar la base de conocimiento
}

// 8. Función para buscar información relevante en la base de conocimiento de IAPOS (RAG)
function buscarInfoIAPOS(query) {
    let resultadosConRelevancia = [];
    const queryLower = query.toLowerCase();

    // Palabras clave que identifican la pregunta sobre "Día Preventivo" específicamente
    const diaPreventivoKeywords = ['día preventivo', 'dia preventivo', 'programa preventivo', 'iapos preventivo'];

    // Priorizar el chunk de introducción si la query es sobre "Día Preventivo"
    let foundIntroChunk = false;
    for (const keyword of diaPreventivoKeywords) {
        if (queryLower.includes(keyword)) {
            // Buscar el chunk específico de introducción
            const introChunk = iaposKnowledge.find(item => item.id === "intro_dia_preventivo_iapos");
            if (introChunk) {
                // Añadirlo con muy alta relevancia para asegurar que siempre esté
                resultadosConRelevancia.push({ item: introChunk, relevancia: 100 });
                foundIntroChunk = true;
                break; // Una vez que lo encontramos, salimos
            }
        }
    }

    // Búsqueda general por palabras clave para el resto de los chunks
    for (const item of iaposKnowledge) {
        // Si ya incluimos el chunk de introducción por prioridad, no lo volvemos a evaluar con menos peso
        if (foundIntroChunk && item.id === "intro_dia_preventivo_iapos") {
            continue;
        }

        let relevancia = 0;
        // Si el query (o sus palabras clave) están en el título
        const titleLower = item.titulo ? item.titulo.toLowerCase() : '';
        if (titleLower.includes(queryLower)) {
            relevancia += 5; // Mayor peso si la frase completa coincide en el título
        } else {
            const queryWords = queryLower.split(' ').filter(word => word.length > 2);
            for (const word of queryWords) {
                if (titleLower.includes(word)) {
                    relevancia += 2; // Menor peso por palabra individual en el título
                }
            }
        }

        // Si el query (o sus palabras clave) están en el contenido
        const contentLower = item.contenido ? item.contenido.toLowerCase() : '';
        if (contentLower.includes(queryLower)) {
            relevancia += 3; // Mayor peso si la frase completa coincide en el contenido
        } else {
            const queryWords = queryLower.split(' ').filter(word => word.length > 2);
            for (const word of queryWords) {
                if (contentLower.includes(word)) {
                    relevancia += 1; // Menor peso por palabra individual en el contenido
                }
            }
        }

        if (relevancia > 0) {
            resultadosConRelevancia.push({ item: item, relevancia: relevancia });
        }
    }

    // Ordenar por relevancia (mayor a menor), manteniendo el chunk de intro arriba si se agregó
    resultadosConRelevancia.sort((a, b) => b.relevancia - a.relevancia);

    // Unir los contenidos de los resultados más relevantes, limitando el tamaño
    let contextoFinal = "";
    let count = 0;
    const MAX_CONTEXT_LENGTH = 3000; // Límite de tokens aproximado para el contexto de IAPOS

    for (const res of resultadosConRelevancia) {
        const potentialContent = `--- Título: ${res.item.titulo}\n${res.item.contenido}\n\n`;
        // Comprobación simple de longitud para evitar exceder el límite de tokens
        if ((contextoFinal.length + potentialContent.length) < MAX_CONTEXT_LENGTH) {
            contextoFinal += potentialContent;
            count++;
            // Limitar a un máximo de 3-4 chunks para evitar sobrecarga y mantener la relevancia alta
            if (count >= 4) break;
        } else {
            break;
        }
    }
    return contextoFinal.trim();
}


// 9. Ruta principal para manejar las consultas del chat
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: 'Mensaje de usuario no proporcionado.' });
    }

    try {
        // Recuperar información relevante de IAPOS (estrategia RAG)
        const contextIAPOS = buscarInfoIAPOS(userMessage);

        console.log('Contexto IAPOS recuperado para Gemini:\n', contextIAPOS);

        // Construir el prompt (la instrucción) para Gemini
    const prompt = `
            Eres un asistente virtual amable, profesional y muy útil de IAPOS, enfocado en brindar información sobre el programa "Día Preventivo" y los servicios de salud preventiva.
            Tu misión es ofrecer respuestas claras, precisas y relevantes a los afiliados, siempre con un tono cercano y empático.
            **Es CRÍTICO que uses la "INFORMACIÓN ESPECÍFICA DE IAPOS" que te proporciono a continuación.** Si la pregunta del afiliado está cubierta por esa información, básate principalmente en ella. Si no hay información directamente relevante, utiliza tu conocimiento general, pero siempre mantén el enfoque en la prevención y los servicios de IAPOS.

            Si la pregunta de un afiliado se refiere a un diagnóstico médico personal, un tratamiento específico o una emergencia de salud, **siempre debes recomendar enfáticamente consultar a un médico o profesional de la salud de IAPOS** y aclarar que tu rol es solo informativo.

            ---

            INFORMACIÓN ESPECÍFICA DE IAPOS Y "DÍA PREVENTIVO" (Básate principalmente en esto si es relevante):
            ${contextIAPOS ? contextIAPOS : "No se encontró información específica directamente relevante en la base de datos de IAPOS para esta consulta."}

            ---

            Ahora, por favor responde a la siguiente pregunta del afiliado:
            "${userMessage}"

            Asegúrate de que tu respuesta sea útil, precisa y siempre con el tono de IAPOS.
        `;


        // Enviar la solicitud a la API de Gemini
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text(); // Obtener el texto de la respuesta de Gemini

        // Enviar la respuesta al frontend
        res.json({ reply: text });

    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini:', error);
        // Puedes refinar los mensajes de error para el usuario
        res.status(500).json({ error: 'Lo siento, hubo un problema técnico al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.' });
    }
});

// 10. Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${port}`);
    console.log(`Abre index.html en tu navegador y apunta a http://localhost:${port}/chat para las peticiones.`);
});