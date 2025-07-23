import os
import json
from pypdf import PdfReader
from docx import Document
import re
import nltk
from nltk.tokenize import sent_tokenize

# --- Configuración ---
INPUT_DIR = 'documentos_fuente'  # Carpeta donde están tus PDFs y DOCX
OUTPUT_JSON_FILE = 'info_dia_preventivo.json' # Tu archivo JSON existente
CHUNK_SIZE_LIMIT = 1500  # Máximo de caracteres por chunk (aprox. 300-400 palabras)
OVERLAP = 200            # Superposición de caracteres entre chunks para no cortar ideas

# --- Funciones de Extracción ---
def extract_text_from_pdf(pdf_path):
    """Extrae texto de un archivo PDF."""
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PdfReader(file)
            for page_num in range(len(reader.pages)):
                text += reader.pages[page_num].extract_text() + " " # Añadir espacio para unir palabras
        return text
    except Exception as e:
        print(f"Error al extraer texto de PDF {pdf_path}: {e}")
        return None

def extract_text_from_docx(docx_path):
    """Extrae texto de un archivo DOCX."""
    text = ""
    try:
        document = Document(docx_path)
        for para in document.paragraphs:
            text += para.text + " "
        return text
    except Exception as e:
        print(f"Error al extraer texto de DOCX {docx_path}: {e}")
        return None

# --- Función de Chunking (División en trozos) ---
def chunk_text(text, source_filename):
    """Divide el texto en chunks con un tamaño y solapamiento."""
    chunks = []
    # Limpiar y normalizar el texto (ej. múltiples espacios a uno solo)
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Dividir el texto en oraciones para intentar no cortar ideas a mitad de frase
    sentences = sent_tokenize(text, language='spanish')
    
    current_chunk = ""
    chunk_id_counter = 0

    for sentence in sentences:
        # Si añadir la oración actual excede el límite, guardamos el chunk actual y empezamos uno nuevo
        if len(current_chunk) + len(sentence) + 1 > CHUNK_SIZE_LIMIT and current_chunk: # +1 for space
            chunks.append(current_chunk.strip())
            # Empezar el nuevo chunk con algo de solapamiento de la parte final del chunk anterior
            current_chunk = current_chunk[max(0, len(current_chunk) - OVERLAP):] + " " + sentence
        else:
            current_chunk += (sentence + " ").strip() # Añadir espacio entre oraciones

    if current_chunk: # Añadir el último chunk si no está vacío
        chunks.append(current_chunk.strip())

    # Formatear los chunks como objetos JSON
    json_chunks = []
    for i, chunk_content in enumerate(chunks):
        # Crear un título simple a partir de las primeras palabras del chunk o el nombre del archivo
        title_suggestion = f"{source_filename.replace('_', ' ').replace('.pdf', '').replace('.docx', '')} - Parte {i+1}"
        
        # Intentar tomar un título más significativo si el chunk es largo y tiene una primera frase clara
        first_sentence = sent_tokenize(chunk_content, language='spanish')[0] if chunk_content else ""
        if len(first_sentence) < 100: # Si la primera frase no es demasiado larga
            title_suggestion = first_sentence.replace('\n', ' ').strip()
            if len(title_suggestion) > 80: # Si sigue siendo larga, acortar
                title_suggestion = title_suggestion[:80] + "..."


        json_chunks.append({
            "id": f"{os.path.splitext(source_filename)[0].replace('.', '_')}_{i + 1}",
            "titulo": title_suggestion,
            "contenido": chunk_content
        })
    return json_chunks

# --- Función Principal ---
def process_documents_to_json():
    """Procesa documentos de una carpeta y actualiza el archivo JSON de conocimiento."""
    all_new_chunks = []

    if not os.path.exists(INPUT_DIR):
        print(f"Error: La carpeta de entrada '{INPUT_DIR}' no existe. Por favor, créala y coloca tus documentos allí.")
        return

    for filename in os.listdir(INPUT_DIR):
        file_path = os.path.join(INPUT_DIR, filename)
        
        if os.path.isfile(file_path): # Asegurarse de que es un archivo y no una carpeta
            text_content = None
            if filename.lower().endswith('.pdf'):
                print(f"Procesando PDF: {filename}")
                text_content = extract_text_from_pdf(file_path)
            elif filename.lower().endswith('.docx'):
                print(f"Procesando DOCX: {filename}")
                text_content = extract_text_from_docx(file_path)
            else:
                print(f"Saltando archivo no compatible: {filename}")
                continue

            if text_content:
                print(f"Dividiendo '{filename}' en chunks...")
                new_chunks = chunk_text(text_content, filename)
                all_new_chunks.extend(new_chunks)
                print(f"Se generaron {len(new_chunks)} chunks para '{filename}'.")
            else:
                print(f"No se pudo extraer texto de '{filename}'.")

    # Cargar el JSON existente, añadir los nuevos chunks, y guardar
    existing_data = []
    if os.path.exists(OUTPUT_JSON_FILE):
        with open(OUTPUT_JSON_FILE, 'r', encoding='utf-8') as f:
            try:
                existing_data = json.load(f)
                if not isinstance(existing_data, list): # Asegurarse de que es una lista
                    existing_data = []
                    print(f"Advertencia: {OUTPUT_JSON_FILE} no es una lista JSON, se reiniciará.")
            except json.JSONDecodeError as e:
                print(f"Error al leer JSON existente en {OUTPUT_JSON_FILE}: {e}. Se creará uno nuevo.")
                existing_data = []

    # Filtrar chunks duplicados por ID (si se vuelve a correr el script)
    existing_ids = {item["id"] for item in existing_data if "id" in item}
    filtered_new_chunks = [chunk for chunk in all_new_chunks if chunk["id"] not in existing_ids]

    existing_data.extend(filtered_new_chunks)

    with open(OUTPUT_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)
    
    print(f"\nProceso completado. Total de chunks en '{OUTPUT_JSON_FILE}': {len(existing_data)}")
    print("¡Recuerda reiniciar tu servidor Node.js (Ctrl+C y npm start) para cargar los nuevos datos!")


if __name__ == "__main__":
    process_documents_to_json()