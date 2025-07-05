# Realtime Interview Copilot

## Description

Realtime Interview Copilot is a web application that assists users in crafting responses during interviews. It leverages real-time audio transcription and AI-powered response generation to provide relevant and concise answers.

## Technologies

- Frontend: React, TypeScript, Next.js, Tailwind CSS, Shadcn/UI
- Backend: Node.js
- APIs: Deepgram (transcription), Anthropic Claude-3-Sonnet (reasoning), Google Gemini (embeddings)
- Vector Database: Pinecone (multimodal embeddings)
- Web Search: Tavily API
- RAG Pipeline: Custom agentic architecture with context fusion

## Features

- Real-time audio transcription using Deepgram
- AI-powered response generation using Anthropic Claude-3-Sonnet
- **RAG-powered contextual responses** with PDF document search
- **Multimodal embeddings** supporting text and image content using Google Gemini
- **Real-time web search** integration with citations
- **Chat-style transcription interface** with smart speaker detection
- PDF document upload and semantic search
- Customizable interview background information
- Transcription text editing with dual view modes (Chat/Text)
- Toggle between Copilot and Summerizer modes
- Automatic question extraction from transcripts
- Context fusion from multiple sources (PDFs + web)
- Smart audio source separation (External vs System audio)

## Installation and Setup

1. Clone the repository:

    ```bash
    git clone https://github.com/innovatorved/realtime-interview-copilot.git
    ```

2. Install dependencies:

    ```bash
    yarn install
    ```

3. Create a `.env.local` file in the project root and add your API keys:

    A template `.env.local` file has been created for you. Replace the placeholder values with your actual API keys:

    - **`DEEPGRAM_API_KEY`**: Get from [Deepgram Console](https://console.deepgram.com/)
    - **`GEMINI_API_KEY`**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey) (for embeddings)
    - **`ANTHROPIC_API_KEY`**: Get from [Anthropic Console](https://console.anthropic.com/) (for reasoning)
    - **`PINECONE_API_KEY`**: Get from [Pinecone Console](https://app.pinecone.io/)
    - **`PINECONE_ENVIRONMENT`**: Your Pinecone environment (default: "us-east1-gcp")
    - **`PINECONE_INDEX_NAME`**: Name of your Pinecone index (default: "interview-docs")
    - **`TAVILY_API_KEY`**: Get from [Tavily Console](https://app.tavily.com/)

4. **Set up your Pinecone vector database:**

    ```bash
    yarn setup-pinecone
    ```

    This will create the required Pinecone index with the correct specifications for Gemini embeddings (768 dimensions).

    ⚠️ **Note**: You must add your actual API keys to `.env.local` before running this command.

5. **Verify your setup:**

    ```bash
    yarn verify-setup
    ```

    This will check all your API keys and connections to ensure everything is configured correctly.

## Usage

1. **Run the development server:**

    ```bash
    yarn dev
    ```

2. **Access the application** in your browser at http://localhost:3000.
3. **Upload PDF documents** to enhance your knowledge base for specific topics.
4. Provide interview background information in the "Interview Background" section.
5. Start listening to the interview conversation by clicking the "Start listening" button.
6. The transcribed text will appear in the "Transcription" section. You can edit it if needed.
7. Choose between Copilot or Summerizer mode using the toggle switch.
8. Click the "Process" button to generate AI-powered responses that:
   - Extract key questions from the transcript
   - Search your uploaded PDFs for relevant context
   - Perform real-time web searches for current information
   - Combine all sources to provide comprehensive, cited responses

## RAG Architecture Features

- **Multimodal Embeddings**: Supports both text and image content using Google Gemini
- **Intelligent Chunking**: Documents are split into 1,000-word semantic chunks
- **Hybrid Search**: Combines PDF document search with real-time web search
- **Context Fusion**: Intelligently merges information from multiple sources
- **Citation Tracking**: All responses include proper source attribution

## Contributing

Contributions are welcome! Please refer to the [CONTRIBUTING.md](https://github.com/innovatorved/realtime-interview-copilot/blob/main/CONTRIBUTING.md) file for guidelines.

## License

This project is licensed under the [License](https://github.com/innovatorved/realtime-interview-copilot/blob/main/LICENSE). See the LICENSE file for details.
