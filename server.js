require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint for search
app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log(`Searching for: ${query}`);

        const response = await callAIWithFallback(query);
        
        res.json({ 
            response: response,
            query: query,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Search API error:', error);
        res.status(500).json({ 
            error: 'Failed to process search request',
            details: error.message 
        });
    }
});

// Main function to try different AI providers
async function callAIWithFallback(query) {
    const providers = [
        { name: 'Hugging Face', func: callHuggingFace },
        { name: 'Cohere', func: callCohere },
        { name: 'Local', func: callLocalAI }
    ];

    for (const provider of providers) {
        try {
            console.log(`Trying ${provider.name}...`);
            const response = await provider.func(query);
            console.log(`✅ ${provider.name} responded successfully`);
            return response;
        } catch (error) {
            console.log(`❌ ${provider.name} failed: ${error.message}`);
            continue;
        }
    }

    throw new Error('All AI providers failed. Please try again later.');
}

async function callHuggingFace(query) {
    if (!HUGGINGFACE_API_KEY) {
        throw new Error('Hugging Face API key not configured');
    }

    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-large',
        {
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({
                inputs: query,
                parameters: {
                    max_length: 1000,
                    temperature: 0.7,
                    do_sample: true,
                }
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const data = await response.json();
    return data[0]?.generated_text || 'No response generated';
}

async function callCohere(query) {
    if (!process.env.COHERE_API_KEY) {
        throw new Error('Cohere API key not configured');
    }

    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.cohere.ai/v1/generate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'command',
            prompt: `Please answer this question comprehensively: ${query}`,
            max_tokens: 1500,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        throw new Error(`Cohere API error: ${response.status}`);
    }

    const data = await response.json();
    return data.generations[0]?.text?.trim() || 'No response generated';
}

async function callLocalAI(query) {
    const responses = {
        'hello': 'Hello! I\'m here to help you with any questions you might have.',
        'how are you': 'I\'m doing well, thank you for asking! How can I assist you today?',
        'what is ai': '**Artificial Intelligence (AI)** refers to computer systems that can perform tasks that typically require human intelligence, such as:\n\n• **Learning** from data and experience\n• **Problem-solving** and decision making\n• **Language processing** and understanding\n• **Pattern recognition** and analysis\n• **Reasoning** and logical thinking',
        'quantum computing': '**Quantum Computing** is a revolutionary computing paradigm that uses quantum mechanical phenomena to process information...',
        'photosynthesis': '**Photosynthesis** is the process by which plants convert sunlight into chemical energy...'
    };

    const lowerQuery = query.toLowerCase();
    
    for (const [keyword, response] of Object.entries(responses)) {
        if (lowerQuery.includes(keyword)) {
            return response;
        }
    }

    return `I couldn't find a built-in answer for: "${query}". Try rephrasing or using a different keyword.`;
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'AI Search API'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 AI Search Server running on port ${PORT}`);
    console.log(`📱 Open your browser to: http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nServer shutting down gracefully...');
    process.exit(0);
});
