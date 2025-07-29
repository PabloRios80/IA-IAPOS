// 1. Cargar variables de entorno al inicio de todo
require('dotenv').config();

// 2. Importar módulos necesarios
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path'); // Para servir archivos estáticos correctamente

// 3. Configurar la aplicación Express
const app = express();
const port = process.env.PORT || 3000;

// 4. Verificar que la clave de API esté presente
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("Error: La clave de API de Gemini no está definida en el archivo .env");
    console.error("Asegúrate de que tu archivo .env tenga 'API_KEY=TU_CLAVE_DE_API_AQUI'");
    process.exit(1);
}

// 4. Configurar Google Sheets (después de API_KEY, antes de model)
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    console.warn("Advertencia: Las credenciales de Google Sheets no están completamente definidas en el archivo .env.");
    console.warn("La funcionalidad de consulta de resultados del Día Preventivo por DNI NO estará disponible.");
    // No salimos de la aplicación, pero la funcionalidad de Sheets no funcionará.
}

let doc; // Variable para almacenar la instancia del documento de Google Sheet

async function initializeGoogleSheet() {
    if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
        console.warn('Omitting Google Sheet initialization due to missing credentials.');
        return;
    }
    try {
        const jwt = new JWT({
            email: CLIENT_EMAIL,
            key: PRIVATE_KEY.replace(/\\n/g, '\n'), // Importante para manejar la clave privada
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
        await doc.loadInfo(); // Carga información del documento, como los nombres de las hojas
        console.log('Google Sheet inicializado:', doc.title);
    } catch (error) {
        console.error('Error al inicializar Google Sheet:', error.message);
        doc = null; // Asegurarse de que `doc` sea null si falla la inicialización
    }
}

// Llamar a la inicialización de Google Sheets al iniciar el servidor
initializeGoogleSheet();

// Función para obtener datos de una hoja específica
async function getDataFromSpecificSheet(sheetName) {
    if (!doc) {
        console.error('Error: Google Sheet document not initialized. Cannot fetch data.');
        throw new Error('Google Sheet document not initialized.');
    }
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
        throw new Error(`Hoja "${sheetName}" no encontrada en el Google Sheet.`);
    }
    const rows = await sheet.getRows();
    return rows.map(row => row.toObject());
}

// Configuración de los campos del Google Sheet para procesar resultados
const fieldsConfig = [
    { name: 'Presion_Arterial', label: 'Presión Arterial', options: ['Control Normal', 'Hipertensión', 'No se realiza'], normalValue: 'Control Normal' },
    { name: 'IMC', label: 'IMC', options: ['Bajo Peso', 'Control Normal', 'Sobrepeso', 'Obesidad', 'Obesidad Grado II', 'Obesidad Mórbida', 'No se realiza'], normalValue: 'Control Normal' },
    { name: 'Agudeza_visual', label: 'Agudeza Visual', options: ['Alterada', 'Control Normal', 'No se realiza'], normalValue: 'Control Normal' },
    { name: 'Control_odontologico', label: 'Control Odontológico', options: ['Control Normal', 'No se realiza', 'Riesgo'], normalValue: 'Control Normal' },
    { name: 'Alimentacion_saludable', label: 'Alimentación Saludable', options: ['Sí', 'No'], normalValue: 'Sí' },
    { name: 'Actividad_fisica', label: 'Actividad Física', options: ['Sí realiza', 'No realiza'], normalValue: 'Sí realiza' },
    { name: 'Seguridad_vial', label: 'Seguridad Vial', options: ['Cumple', 'No cumple', 'No realiza'], normalValue: 'Cumple' },
    { name: 'Cuidados_adultos_mayores', label: 'Cuidados Adultos Mayores', options: ['No se realiza', 'Se verifica'], normalValue: 'Se verifica' },
    { name: 'Acido_folico', label: 'Ácido Fólico', options: ['Indicado', 'No indicado'], normalValue: 'No indicado' },
    { name: 'Abuso_alcohol', label: 'Abuso Alcohol', options: ['Abuso', 'No abusa', 'No se realiza'], normalValue: 'No abusa' },
    { name: 'Tabaco', label: 'Tabaco', options: ['Fuma', 'No fuma'], normalValue: 'No fuma' },
    { name: 'Violencia', label: 'Violencia', options: ['Se verifica', 'No se verifica', 'No se realiza'], normalValue: 'No se verifica' }, // Asumo "No se verifica" es lo "normal" en el contexto de que no se identificó violencia
    { name: 'Diabetes', label: 'Diabetes', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Dislipemia', label: 'Dislipemia', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Cancer_mama', label: 'Cáncer de Mama', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Cancer_cervicouterino', label: 'Cáncer Cervicouterino', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Cancer_colon', label: 'Cáncer de Colon', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Cancer_prostata', label: 'Cáncer de Próstata', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'HIV', label: 'HIV', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Hepatitis_B', label: 'Hepatitis B', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Hepatitis_C', label: 'Hepatitis C', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Sifilis', label: 'Sífilis', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Chagas', label: 'Chagas', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Salud_renal', label: 'Salud Renal', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Depresion', label: 'Depresión', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'EPOC', label: 'EPOC', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Aneurisma_aorta', label: 'Aneurisma de Aorta', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Osteoporosis', label: 'Osteoporosis', options: ['Sí', 'No'], normalValue: 'No' },
    { name: 'Uso_aspirina', label: 'Uso de Aspirina', options: ['Sí', 'No'], normalValue: 'No' }
];


// Definición del menú de categorías y subtemas para el frontend
const IAPOS_PREVENTIVE_PROGRAM_MENU = [
    {
        category: "Evaluación de Riesgo Cardiovascular y Enfermedades Crónicas",
        icon: "heart-pulse", // Font Awesome icon name (fas fa-heart-pulse)
        color: "red-600", // Tailwind CSS color class
        subtopics: [
            {
                name: "Diabetes",
                chunkId: "Todo Prevencion Dia Preventivo_diabetes", // ID exacto de tu JSON
                questions: [
                    "¿Qué es la Diabetes?",
                    "¿Cómo se previene la Diabetes?",
                    "¿Qué prácticas o análisis se realizan para la Diabetes?",
                    "Síntomas de la Diabetes."
                ]
            },
            {
                name: "Presión Arterial",
                chunkId: "Todo Prevencion Dia Preventivo_hipertension", // ID exacto
                questions: [
                    "¿Qué es la Presión Arterial alta?",
                    "¿Cómo se previene la Hipertensión Arterial?",
                    "¿Qué prácticas o análisis se realizan para la Presión Arterial?",
                    "Síntomas de la Presión Arterial alta."
                ]
            },
            {
                name: "Dislipemias",
                chunkId: "Todo Prevencion Dia Preventivo_dislipemias", // ID exacto
                questions: [
                    "¿Qué son las Dislipemias (colesterol/triglicéridos)?",
                    "¿Cómo se previenen las Dislipemias?",
                    "¿Qué prácticas o análisis se realizan para las Dislipemias?",
                    "Síntomas o riesgos de las Dislipemias."
                ]
            },
            {
                name: "IMC", // Índice de Masa Corporal
                chunkId: "Todo Prevencion Dia Preventivo_obesidad", // Relacionado con obesidad
                questions: [
                    "¿Qué es el IMC?",
                    "¿Cómo se mantiene un IMC saludable?",
                    "¿Qué prácticas o análisis se realizan relacionados con el IMC?",
                    "Riesgos de un IMC elevado."
                ]
            },
            {
                name: "Tabaquismo",
                chunkId: "Todo Prevencion Dia Preventivo_tabaquismo", // ID exacto
                questions: [
                    "¿Qué es el Tabaquismo?",
                    "¿Cómo se previene o abandona el Tabaquismo?",
                    "¿Qué prácticas o programas hay para el Tabaquismo?",
                    "Síntomas o consecuencias del Tabaquismo."
                ]
            }
        ]
    },
    {
        category: "Prevención de Cáncer",
        icon: "ribbon", // Font Awesome icon name (fas fa-ribbon)
        color: "purple-600",
        subtopics: [
            {
                name: "Cáncer de Mama",
                chunkId: "Todo Prevencion Dia Preventivo_cancer de mama", // ID exacto
                questions: [
                    "¿Qué es el Cáncer de Mama?",
                    "¿Cómo se previene el Cáncer de Mama?",
                    "¿Qué prácticas o análisis se realizan para el Cáncer de Mama?",
                    "Síntomas del Cáncer de Mama."
                ]
            },
            {
                name: "Cáncer Cervicouterino",
                chunkId: "Todo Prevencion Dia Preventivo_RASTREO DE CÁNCER CERVICOUTERINO", // ID exacto
                questions: [
                    "¿Qué es el Cáncer Cervicouterino?",
                    "¿Cómo se previene el Cáncer Cervicouterino?",
                    "¿Qué prácticas o análisis se realizan para el Cáncer Cervicouterino?",
                    "Síntomas del Cáncer Cervicouterino."
                ]
            },
            {
                name: "Cáncer de Colon",
                chunkId: "Todo Prevencion Dia Preventivo_cancer de colon", // Asumo que tienes un chunk para este
                questions: [
                    "¿Qué es el Cáncer de Colon?",
                    "¿Cómo se previene el Cáncer de Colon?",
                    "¿Qué prácticas o análisis se realizan para el Cáncer de Colon?",
                    "Síntomas del Cáncer de Colon."
                ]
            },
            {
                name: "Cáncer de Próstata",
                chunkId: "Todo Prevencion Dia Preventivo_cancer de prostata", // Asumo que tienes un chunk para este
                questions: [
                    "¿Qué es el Cáncer de Próstata?",
                    "¿Cómo se previene el Cáncer de Próstata?",
                    "¿Qué prácticas o análisis se realizan para el Cáncer de Próstata?",
                    "Síntomas del Cáncer de Próstata."
                ]
            }
        ]
    },
    {
        category: "Prevención de Enfermedades Infecciosas",
        icon: "viruses", // Font Awesome icon name (fas fa-viruses)
        color: "green-600",
        subtopics: [
            { name: "HIV", chunkId: "Todo Prevencion Dia Preventivo_HIV", questions: ["¿Qué es el HIV?", "¿Cómo se previene el HIV?", "¿Qué prácticas o análisis se realizan para el HIV?", "Síntomas del HIV."] },
            { name: "Hepatitis B", chunkId: "Todo Prevencion Dia Preventivo_Hepatitis_B", questions: ["¿Qué es la Hepatitis B?", "¿Cómo se previene la Hepatitis B?", "¿Qué prácticas o análisis se realizan para la Hepatitis B?", "Síntomas de la Hepatitis B."] },
            { name: "Hepatitis C", chunkId: "Todo Prevencion Dia Preventivo_Hepatitis_C", questions: ["¿Qué es la Hepatitis C?", "¿Cómo se previene la Hepatitis C?", "¿Qué prácticas o análisis se realizan para la Hepatitis C?", "Síntomas de la Hepatitis C."] },
            { name: "Sífilis", chunkId: "Todo Prevencion Dia Preventivo_sifilis", questions: ["¿Qué es la Sífilis?", "¿Cómo se previene la Sífilis?", "¿Qué prácticas o análisis se realizan para la Sífilis?", "Síntomas de la Sífilis."] },
            { name: "Chagas", chunkId: "Todo Prevencion Dia Preventivo_chagas", questions: ["¿Qué es el Chagas?", "¿Cómo se previene el Chagas?", "¿Qué prácticas o análisis se realizan para el Chagas?", "Síntomas del Chagas."] }
        ]
    },
    {
        category: "Hábitos Saludables",
        icon: "leaf", // Font Awesome icon name (fas fa-leaf)
        color: "lime-600",
        subtopics: [
            { name: "Alimentación Saludable", chunkId: "Todo Prevencion Dia Preventivo_alimentacion_saludable", questions: ["¿Qué es la Alimentación Saludable?", "¿Cómo llevar una Alimentación Saludable?", "¿Qué prácticas o programas hay para la Alimentación Saludable?", "Beneficios de la Alimentación Saludable."] },
            { name: "Actividad Física", chunkId: "Todo Prevencion Dia Preventivo_actividad_fisica", questions: ["¿Qué es la Actividad Física?", "¿Cómo incorporar Actividad Física en mi rutina?", "¿Qué prácticas o programas hay para la Actividad Física?", "Beneficios de la Actividad Física."] },
            { name: "Seguridad Vial", chunkId: "Todo Prevencion Dia Preventivo_seguridad_vial", questions: ["¿Qué es la Seguridad Vial?", "¿Cómo practicar la Seguridad Vial?", "¿Qué programas hay sobre Seguridad Vial?", "Importancia de la Seguridad Vial."] },
            { name: "Consumo de Alcohol", chunkId: "Todo Prevencion Dia Preventivo_abuso_de_alcohol", questions: ["¿Qué es el Consumo Problemático de Alcohol?", "¿Cómo se previene el Consumo Problemático de Alcohol?", "¿Qué prácticas o ayuda hay para el Consumo de Alcohol?", "Riesgos del Consumo de Alcohol."] },
            { name: "Prevención de Caídas", chunkId: "Todo Prevencion Dia Preventivo_prevencion_caidas", questions: ["¿Cómo se previenen las caídas?", "¿Quiénes tienen mayor riesgo de caídas?", "¿Qué medidas de seguridad hay para prevenir caídas?", "Importancia de la Prevención de Caídas."] },
            { name: "Ácido Fólico", chunkId: "Todo Prevencion Dia Preventivo_acido_folico", questions: ["¿Qué es el Ácido Fólico?", "¿Para qué sirve el Ácido Fólico?", "¿Quiénes deben tomar Ácido Fólico?", "Beneficios del Ácido Fólico."] }
        ]
    },
    {
        category: "Salud Bucal",
        icon: "tooth", // Font Awesome icon name (fas fa-tooth)
        color: "teal-600",
        subtopics: [
            { name: "Salud Bucal", chunkId: "Todo Prevencion Dia Preventivo_salud_bucal", questions: ["¿Qué es la Salud Bucal?", "¿Cómo mantener una buena Salud Bucal?", "¿Qué prácticas o análisis se realizan para la Salud Bucal?", "Síntomas o problemas de Salud Bucal."] }
        ]
    },
    {
        category: "Salud Mental",
        icon: "brain", // Font Awesome icon name (fas fa-brain)
        color: "orange-600",
        subtopics: [
            { name: "Depresión", chunkId: "Todo Prevencion Dia Preventivo_depresion", questions: ["¿Qué es la Depresión?", "¿Cómo se previene o aborda la Depresión?", "¿Qué prácticas o ayuda hay para la Depresión?", "Síntomas de la Depresión."] },
            { name: "Violencia", chunkId: "Todo Prevencion Dia Preventivo_violencia", questions: ["¿Qué tipos de Violencia existen?", "¿Cómo se previene la Violencia?", "¿Qué prácticas o ayuda hay para situaciones de Violencia?", "Dónde buscar ayuda en casos de Violencia."] }
        ]
    },
    {
        category: "Salud Renal",
        icon: "kidneys", // Font Awesome icon name (fas fa-kidneys)
        color: "blue-600",
        subtopics: [
            { name: "Salud Renal", chunkId: "Todo Prevencion Dia Preventivo_salud_renal", questions: ["¿Qué es la Salud Renal?", "¿Cómo se previene la enfermedad renal?", "¿Qué prácticas o análisis se realizan para la Salud Renal?", "Síntomas de problemas renales."] }
        ]
    },
    {
        category: "Agudeza Visual",
        icon: "eye", // Font Awesome icon name (fas fa-eye)
        color: "indigo-600",
        subtopics: [
            { name: "Agudeza Visual", chunkId: "Todo Prevencion Dia Preventivo_agudeza_visual", questions: ["¿Qué es la Agudeza Visual?", "¿Cómo se evalúa la Agudeza Visual?", "¿Qué prácticas o análisis se realizan para la Agudeza Visual?", "Problemas comunes de Agudeza Visual."] }
        ]
    },
    {
        category: "EPOC",
        icon: "lungs", // Font Awesome icon name (fas fa-lungs)
        color: "cyan-600",
        subtopics: [
            { name: "EPOC", chunkId: "Todo Prevencion Dia Preventivo_EPOC", questions: ["¿Qué es la EPOC?", "¿Cómo se previene la EPOC?", "¿Qué prácticas o análisis se realizan para la EPOC?", "Síntomas de la EPOC."] }
        ]
    },
    {
        category: "Aneurisma de Aorta",
        icon: "maximize", // Font Awesome icon name (fas fa-maximize) - (representa dilatación)
        color: "pink-600",
        subtopics: [
            { name: "Aneurisma de Aorta", chunkId: "Todo Prevencion Dia Preventivo_aneurisma_aorta", questions: ["¿Qué es un Aneurisma de Aorta?", "¿Cómo se previene un Aneurisma de Aorta?", "¿Qué prácticas o análisis se realizan para el Aneurisma de Aorta?", "Síntomas de un Aneurisma de Aorta."] }
        ]
    },
    {
        category: "Osteoporosis",
        icon: "bone", // Font Awesome icon name (fas fa-bone)
        color: "amber-600", // Usamos amber-600 como sustituto de brown-600 en Tailwind
        subtopics: [
            { name: "Osteoporosis", chunkId: "Todo Prevencion Dia Preventivo_osteoporosis", questions: ["¿Qué es la Osteoporosis?", "¿Cómo se previene la Osteoporosis?", "¿Qué prácticas o análisis se realizan para la Osteoporosis?", "Síntomas de la Osteoporosis."] }
        ]
    },
    {
        category: "Uso de Aspirina",
        icon: "pills", // Font Awesome icon name (fas fa-pills)
        color: "gray-600",
        subtopics: [
            { name: "Uso de Aspirina", chunkId: "Todo Prevencion Dia Preventivo_uso_aspirina", questions: ["¿Para qué se usa la Aspirina en prevención?", "¿Quiénes deberían considerar el uso de Aspirina?", "¿Qué precauciones hay con la Aspirina?", "Riesgos del uso de Aspirina."] }
        ]
    }
    // Asegúrate de que los IDs (chunkId) en esta estructura coincidan EXACTAMENTE con los IDs de tus chunks en info_dia_preventivo.json
];


async function obtenerResultadosDiaPreventivoPorDNI(dni) {
    if (!doc) {
        throw new Error('Google Sheet document not initialized or failed to load. Cannot retrieve DNI results.');
    }
    try {
        // Asegúrate de que 'Hoja 1' es el nombre exacto de tu hoja en Google Sheets
        const dpSheetName = 'Hoja 1';
        console.log(`Intentando obtener datos de la hoja: "${dpSheetName}" para DNI: ${dni}`);
        const dpData = await getDataFromSpecificSheet(dpSheetName);
        console.log(`Datos obtenidos de la hoja. Total de filas: ${dpData.length}`);
        // console.log('Primeras 5 filas de datos (para depuración):', dpData.slice(0, 5)); // Descomentar para depuración

        const resultadosPaciente = dpData.find(row => {
            // Considera múltiples nombres de columna para DNI si tu hoja varía
            const dniInSheet = String(row['DNI'] || row['Documento'] || '').trim();
            // console.log(`Comparando DNI buscado "${String(dni).trim()}" con fila DNI: "${dniInSheet}"`); // Descomentar para depuración
            return dniInSheet === String(dni).trim();
        });

        if (!resultadosPaciente) {
            return null; // No se encontraron resultados para ese DNI
        }

        const resultadosNormales = [];
        const resultadosAnormales = [];
        // No necesitamos observaciones como un objeto separado si ya están en resultadosAnormales
        let nombreAfiliado = resultadosPaciente['Nombre_Paciente'] || '';
        let apellidoAfiliado = resultadosPaciente['Apellido_Paciente'] || '';
        if (resultadosPaciente['Nombre']) nombreAfiliado = resultadosPaciente['Nombre'];
        if (resultadosPaciente['Apellido']) apellidoAfiliado = resultadosPaciente['Apellido'];

        const fullNombre = `${nombreAfiliado} ${apellidoAfiliado}`.trim();

        for (const field of fieldsConfig) {
            const fieldName = field.name;
            const fieldValue = (resultadosPaciente[fieldName] || '').trim(); // Asegurarse de trim()
            const obsFieldName = `Observaciones_${fieldName}`;
            const obsValue = (resultadosPaciente[obsFieldName] || '').trim();

            if (fieldValue) {
                // Comparamos el valor de la celda con el valor "normal" configurado
                if (field.normalValue !== undefined && fieldValue === field.normalValue) {
                    resultadosNormales.push({
                        label: field.label,
                        value: fieldValue
                    });
                } else if (field.normalValue !== undefined && fieldValue !== field.normalValue) {
                    // Si hay un valor normal definido y no coincide, es "anormal"
                    resultadosAnormales.push({
                        label: field.label,
                        value: fieldValue,
                        observation: obsValue || 'No hay observaciones adicionales.'
                    });
                } else if (field.normalValue === undefined) {
                    // Si no hay un valor normal definido, solo lo agregamos a normales si tiene un valor
                    // (Esto es para campos como "Se verifica" o "Sí", que no tienen un opuesto "anormal" claro en el contexto)
                    resultadosNormales.push({
                        label: field.label,
                        value: fieldValue
                    });
                }
            }
        }

        return {
            nombre: fullNombre,
            resultadosNormales: resultadosNormales,
            resultadosAnormales: resultadosAnormales,
            // observaciones ya están incluidas en resultadosAnormales
            rawData: resultadosPaciente
        };

    } catch (error) {
        console.error('Error al obtener resultados del Día Preventivo por DNI:', error);
        throw error;
    }
}


// Función para generar recomendaciones basadas en los resultados del Día Preventivo
// Esta función usará Gemini para interpretar los resultados y generar consejos.
async function generarRecomendaciones(resultadosDiaPreventivo) {
    let prompt = `Eres un asistente de salud de IAPOS. Basado en los siguientes resultados del programa Día Preventivo para el afiliado ${resultadosDiaPreventivo.nombre || 'sin nombre'}:
    `;

    if (resultadosDiaPreventivo.resultadosAnormales.length > 0) {
        prompt += "\n\nResultados NO NORMALES (requieren atención):\n";
        resultadosDiaPreventivo.resultadosAnormales.forEach(res => {
            prompt += `- ${res.label}: ${res.value}. Observaciones: ${res.observation}\n`;
        });
        prompt += "\nPor favor, genera recomendaciones personalizadas y claras para el afiliado, explicando brevemente la importancia de cada resultado no normal y sugiriendo los siguientes pasos para abordar cada uno, como consultar con el médico, realizar cambios en el estilo de vida o seguir indicaciones específicas de IAPOS. Sé conciso y empático, priorizando la acción y la educación.\n";
    } else {
        prompt += "\n\nTodos los resultados son NORMALES. ¡Felicitaciones!\n";
        prompt += "\nPor favor, genera un mensaje de felicitación al afiliado por sus excelentes resultados y anímale a mantener sus hábitos saludables, enfatizando la importancia de la prevención continua. Sugiere que puede seguir explorando el programa Día Preventivo para aprender más.\n";
    }

    // Añadir contexto general del programa Día Preventivo
    const introChunk = getChunkContentById("intro_dia_preventivo_iapos");
    if (introChunk) {
        prompt += `\n\nContexto general del programa Día Preventivo de IAPOS:\n${introChunk}\n`;
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error al generar recomendaciones con Gemini:', error);
        return 'Lo siento, no pude generar recomendaciones en este momento. Por favor, intenta de nuevo más tarde o consulta con un profesional de la salud.';
    }
}


// 5. Inicializar la API de Gemini
const genAI = new GoogleGenerativeAI(API_KEY);
// Puedes elegir entre "gemini-pro" (para texto) o "gemini-1.5-flash" (más rápido, ideal para chat)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 6. Configurar Middlewares de Express
app.use(express.json()); // Habilita el parseo de JSON en el cuerpo de las peticiones
// Configuración de CORS:
app.use(cors({
    origin: '*', // Permite cualquier origen (solo para desarrollo). En producción, especifica tu dominio.
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
// Servir archivos estáticos (como tu index.html, style.css, y la carpeta images)
app.use(express.static(path.join(__dirname, 'public')));


// 7. Cargar la base de conocimiento de IAPOS
let iaposKnowledge = [];
try {
    iaposKnowledge = require('./info_dia_preventivo.json');
    console.log(`Base de conocimiento de IAPOS cargada con ${iaposKnowledge.length} ítems.`);
} catch (error) {
    console.error("Error al cargar info_dia_preventivo.json:", error.message);
    console.error("Asegúrate de que el archivo existe y es un JSON válido en la raíz del proyecto.");
    process.exit(1); // Salir si no se puede cargar la base de conocimiento
}

// Función para obtener el contenido de un chunk por su ID
function getChunkContentById(chunkId) {
    const item = iaposKnowledge.find(item => item.id === chunkId);
    if (item) {
        // Formatear el contenido para ser legible por el modelo y mantener el contexto
        let formattedContent = `--- Título: ${item.titulo || 'Sin título'}`;
        if (item.subtitulo) {
            formattedContent += ` - ${item.subtitulo}`;
        }
        formattedContent += `\n${item.contenido || 'Sin contenido'}\n`;
        return formattedContent;
    }
    return null;
}


// 8. Función para buscar información relevante en la base de conocimiento de IAPOS (RAG)
function buscarInfoIAPOS(query, currentTopicChunkId = null) {
    let contextoFinal = "";
    const queryLower = query.toLowerCase();
    const resultadosConRelevancia = [];

    if (!iaposKnowledge || iaposKnowledge.length === 0) {
        console.warn("ADVERTENCIA: La base de conocimiento de IAPOS está vacía o no cargada.");
        return "";
    }

    // Si se especificó un chunkId de tema actual, darle prioridad
    if (currentTopicChunkId) {
        const specificChunk = iaposKnowledge.find(item => item.id === currentTopicChunkId);
        if (specificChunk) {
            resultadosConRelevancia.push({ item: specificChunk, relevancia: 5000 }); // Muy alta relevancia
        }
    }

    // Priorizar chunks específicos si la query contiene palabras clave del "Día Preventivo"
    const diaPreventivoKeywords = ['día preventivo', 'dia preventivo', 'programa preventivo', 'iapos preventivo', 'que es el dia preventivo', 'informacion dia preventivo'];
    let introChunkAdded = false;
    if (diaPreventivoKeywords.some(keyword => queryLower.includes(keyword))) {
        const introChunk = iaposKnowledge.find(item => item.id === "intro_dia_preventivo_iapos");
        if (introChunk && !resultadosConRelevancia.some(r => r.item.id === "intro_dia_preventivo_iapos")) {
            resultadosConRelevancia.push({ item: introChunk, relevancia: 1000 });
            introChunkAdded = true;
        }
    }

    // Búsqueda general de relevancia en todos los chunks
    for (const item of iaposKnowledge) {
        if (introChunkAdded && item.id === "intro_dia_preventivo_iapos") continue;
        if (currentTopicChunkId && item.id === currentTopicChunkId) continue; // Ya agregado con alta relevancia

        let relevancia = 0;
        const titleLower = (item.titulo || '').toLowerCase();
        const contentLower = (item.contenido || '').toLowerCase();
        const subtituloLower = (item.subtitulo || '').toLowerCase();

        // Ponderación por coincidencia EXACTA de la frase completa de la query
        if (titleLower.includes(queryLower)) {
            relevancia += 50;
        }
        if (subtituloLower.includes(queryLower)) {
            relevancia += 40;
        }
        if (contentLower.includes(queryLower)) {
            relevancia += 20;
        }

        // Ponderación por coincidencia de PALABRAS CLAVE individuales de la query
        const queryWords = queryLower.split(' ').filter(word => word.length > 2);
        for (const word of queryWords) {
            if (titleLower.includes(word)) relevancia += 10;
            if (subtituloLower.includes(word)) relevancia += 8;
            if (contentLower.includes(word)) relevancia += 4;
        }

        // --- PALABRAS CLAVE ESPECÍFICAS POR TEMA (Puedes ajustar pesos) ---
        // Se sugiere que los 'chunkId' sean más consistentes como 'Todo_Prevencion_Dia_Preventivo_nombre_tema'
        const topicKeywords = {
            'diabetes': ['diabetes', 'glucosa', 'azúcar en sangre', 'mellitus', 'findrisc'],
            'hipertension': ['hipertensión', 'hta', 'presión arterial', 'presion alta', 'tension alta'],
            'dislipemias': ['dislipemia', 'colesterol', 'triglicéridos', 'grasa en sangre', 'ldl', 'hdl'],
            'obesidad': ['obesidad', 'sobrepeso', 'imc', 'indice masa corporal', 'grasa corporal', 'circunferencia cintura'],
            'tabaquismo': ['tabaquismo', 'fumar', 'cigarrillo', 'nicotina', 'dejar de fumar', 'humo'],
            'cancer de mama': ['cáncer de mama', 'mamografía', 'autoexamen', 'tumores mamarios'],
            'RASTREO DE CÁNCER CERVICOUTERINO': ['cáncer cervicouterino', 'cáncer de cuello uterino', 'vph', 'hpv', 'pap', 'papanicolau'],
            'cancer de colon': ['cáncer de colon', 'colonoscopia', 'sangre en heces', 'pólipos'],
            'cancer de prostata': ['cáncer de próstata', 'psa', 'tacto rectal', 'hiperplasia'],
            'HIV': ['hiv', 'vih', 'sida', 'prevención hiv', 'prueba hiv'],
            'Hepatitis_B': ['hepatitis b', 'vacuna hepatitis b', 'virus hepatitis b'],
            'Hepatitis_C': ['hepatitis c', 'virus hepatitis c', 'tratamiento hepatitis c'],
            'sifilis': ['sífilis', 'enfermedad venérea', 'ets', 'ulcera'],
            'chagas': ['chagas', 'vinchuca', 'enfermedad de chagas', 'tripanozoma cruzi'],
            'alimentacion_saludable': ['alimentación saludable', 'dieta', 'nutrición', 'comer bien', 'hábitos alimenticios'],
            'actividad_fisica': ['actividad física', 'ejercicio', 'moverse', 'deporte', 'sedentarismo'],
            'seguridad_vial': ['seguridad vial', 'manejar', 'coche', 'cinturón', 'moto', 'casco'],
            'abuso_de_alcohol': ['alcohol', 'abuso de alcohol', 'consumo problemático', 'beber'],
            'prevencion_caidas': ['prevención de caídas', 'equilibrio', 'adultos mayores', 'seguridad en el hogar'],
            'acido_folico': ['ácido fólico', 'folato', 'vitamina b9', 'embarazo', 'malformaciones'],
            'salud_bucal': ['salud bucal', 'dientes', 'encías', 'cepillado', 'odontólogo'],
            'depresion': ['depresión', 'tristeza', 'ánimo', 'sentimientos', 'psicólogo', 'terapia'],
            'violencia': ['violencia', 'abuso', 'maltrato', 'ayuda', 'contención'],
            'salud_renal': ['salud renal', 'riñones', 'insuficiencia renal', 'diálisis'],
            'agudeza_visual': ['agudeza visual', 'vista', 'ojos', 'optometrista', 'gafas'],
            'EPOC': ['epoc', 'enfermedad pulmonar obstructiva crónica', 'disnea', 'espirometría'],
            'aneurisma_aorta': ['aneurisma de aorta', 'aorta', 'dilatación', 'cirugía de aorta'],
            'osteoporosis': ['osteoporosis', 'huesos', 'densitometría', 'fracturas'],
            'uso_aspirina': ['aspirina', 'ácido acetilsalicílico', 'prevención cardiovascular', 'anticoagulante'],
            'intro_dia_preventivo_iapos': diaPreventivoKeywords
        };

        for (const topicId in topicKeywords) {
            if (topicKeywords[topicId].some(keyword => queryLower.includes(keyword))) {
                if (item.id && item.id.includes(topicId.replace(/ /g, '_').toLowerCase())) { // Ajuste para que los IDs coincidan con los del JSON
                    relevancia += 150; // Prioridad alta para el chunk específico del tema
                    break; // No es necesario revisar más palabras clave para este item
                }
            }
        }
        
        if (relevancia > 0) {
            resultadosConRelevancia.push({ item: item, relevancia: relevancia });
        }
    }

    // Ordenar por relevancia (mayor a menor)
    resultadosConRelevancia.sort((a, b) => b.relevancia - a.relevancia);

    // CONSOLE.LOGS PARA DEPURACIÓN
    console.log(`\n--- INICIO DEPURACIÓN RAG para QUERY: "${query}" (currentTopicChunkId: ${currentTopicChunkId})---`);
    console.log("Resultados con relevancia (top 5):", resultadosConRelevancia.slice(0, 5).map(r => ({ titulo: r.item.titulo, relevancia: r.relevancia, id: r.item.id })));

    let count = 0;
    let currentLength = 0;
    const MAX_CONTEXT_LENGTH = 3500; // Límite de caracteres para el contexto (ajustado ligeramente)

    for (const res of resultadosConRelevancia) {
        const contentToAdd = getChunkContentById(res.item.id); // Usamos la función para formatear
        
        if (contextoFinal.includes(contentToAdd)) {
            continue;
        }

        if (currentLength + contentToAdd.length <= MAX_CONTEXT_LENGTH) {
            contextoFinal += contentToAdd;
            currentLength += contentToAdd.length;
            count++;
            if (count >= 5) break; // Límite de 5 chunks de información
        } else {
            break; // No agregar más si excede el límite de longitud
        }
    }

    console.log("Contexto IAPOS FINAL que se pasa a Gemini (longitud: " + contextoFinal.length + "):");
    // console.log(contextoFinal); // Descomentar para ver el contexto completo
    console.log(`--- FIN DEPURACIÓN RAG para QUERY: "${query}" ---\n`);

    return contextoFinal;
}


// 9. Rutas de la API

// Ruta para servir el menú de categorías al frontend
app.get('/get-preventive-menu', (req, res) => {
    res.json(IAPOS_PREVENTIVE_PROGRAM_MENU);
});


// Ruta principal para el chat
app.post('/chat', async (req, res) => {
    const { message, dni, currentTopicChunkId } = req.body; // Recibe también el DNI y el chunkId

    if (!message) {
        return res.status(400).json({ error: "El mensaje es requerido." });
    }

    try {
        let fullPrompt = `Eres un asistente virtual amable y servicial de IAPOS, enfocado en brindar información precisa y útil sobre el programa "Día Preventivo". Responde siempre basándote estrictamente en la información proporcionada. Si la información no está disponible en tu base de conocimiento, o si la pregunta es irrelevante para el programa Día Preventivo o el usuario no es de IAPOS, indícalo claramente y sugiere que consulten las fuentes oficiales de IAPOS o a un médico. No inventes información.\n\n`;
        
        let infoContext = '';

        // Prioridad 1: Si el usuario pide sus resultados y proporciona DNI
        const checkResultsKeywords = ['mis resultados', 'resultados', 'quiro mis resultados', 'ver mis resultados', 'consulta mis resultados'];
        const isAskingForResults = checkResultsKeywords.some(keyword => message.toLowerCase().includes(keyword)) || message.toLowerCase().includes('quiero mis resultados');

        if (isAskingForResults && dni) {
            try {
                const resultados = await obtenerResultadosDiaPreventivoPorDNI(dni);
                if (resultados) {
                    const recomendaciones = await generarRecomendaciones(resultados);
                    return res.json({ response: recomendaciones });
                } else {
                    return res.json({ response: `Lo siento, no encontré resultados del Día Preventivo para el DNI ${dni}. Por favor, verifica que el DNI sea correcto y que estés afiliado al programa. También puedes consultar esta información directamente con IAPOS.` });
                }
            } catch (error) {
                console.error('Error al procesar consulta de resultados por DNI:', error);
                // Si la hoja no se inicializó, el error de getDataFromSpecificSheet lo manejará
                if (error.message.includes('Google Sheet document not initialized')) {
                    return res.status(500).json({ error: 'La funcionalidad de consulta de resultados no está disponible en este momento debido a un problema de configuración. Por favor, inténtalo más tarde.' });
                }
                return res.status(500).json({ error: 'Ocurrió un error al buscar tus resultados. Por favor, intenta de nuevo más tarde.' });
            }
        }
        
        // Prioridad 2: Buscar información en la base de conocimiento de IAPOS (RAG)
        infoContext = buscarInfoIAPOS(message, currentTopicChunkId);

        if (infoContext) {
            fullPrompt += `Información de contexto IAPOS relevante:\n${infoContext}\n\n`;
        } else {
            fullPrompt += `No se encontró información específica en la base de conocimiento de IAPOS para tu pregunta.`;
        }

        fullPrompt += `Pregunta del usuario: "${message}"\n`;
        fullPrompt += `Tu respuesta debe ser útil y basada solo en el contexto proporcionado sobre el programa Día Preventivo de IAPOS.`;

        // Si el contexto está vacío, podemos dar una respuesta predeterminada más inteligente
        if (!infoContext && !isAskingForResults) {
            fullPrompt = `Eres un asistente virtual amable y servicial de IAPOS, enfocado en brindar información precisa y útil sobre el programa "Día Preventivo".
            La pregunta del usuario es: "${message}".
            No se encontró información relevante en tu base de conocimiento para esta pregunta específica sobre el programa Día Preventivo.
            Por favor, responde amablemente que no tienes información para esa consulta y sugiere que el usuario puede explorar los temas disponibles en el menú de categorías o reformular su pregunta para que se ajuste mejor al programa.`;
        }


        // Usar el modelo de Gemini para generar la respuesta
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        res.json({ response: text }); // Enviar la respuesta del bot

    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini:', error);
        res.status(500).json({ error: 'Ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo más tarde.' });
    }
});


// 10. Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${port}`);
    console.log(`Accede a la aplicación en http://localhost:${port}/index.html`); // Instrucción clara
});