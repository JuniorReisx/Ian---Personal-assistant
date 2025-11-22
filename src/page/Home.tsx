import { useState, useEffect, useRef } from 'react';
import { Heart, Calendar, MessageCircle, Plus, Clock, Trash2, Phone, Activity, Coffee, Book, Music, Moon, Sun, Mic, MicOff, Volume2 } from 'lucide-react';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Declaração de tipos para a API de storage do Claude
declare global {
    interface Window {
        storage: {
            get(key: string, shared?: boolean): Promise<{ key: string, value: string, shared: boolean } | null>;
            set(key: string, value: string, shared?: boolean): Promise<{ key: string, value: string, shared: boolean } | null>;
            delete(key: string, shared?: boolean): Promise<{ key: string, deleted: boolean, shared: boolean } | null>;
            list(prefix?: string, shared?: boolean): Promise<{ keys: string[], prefix?: string, shared: boolean } | null>;
        };
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

interface Medication {
    id: string;
    name: string;
    time: string;
    taken: boolean;
}

interface Appointment {
    id: string;
    title: string;
    date: string;
    time: string;
    location?: string;
    notified?: boolean;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function Home() {
    const [activeTab, setActiveTab] = useState('home');
    const [medications, setMedications] = useState<Medication[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [showAddMed, setShowAddMed] = useState(false);
    const [showAddAppt, setShowAddAppt] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userName, setUserName] = useState('');
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    
    // Estados para reconhecimento de voz
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    const activities = [
        { icon: Activity, title: 'Caminhada leve', desc: '15 minutos ao ar livre' },
        { icon: Coffee, title: 'Café com amigos', desc: 'Socializar faz bem' },
        { icon: Book, title: 'Ler um livro', desc: 'Estimula a mente' },
        { icon: Music, title: 'Ouvir música', desc: 'Relaxante e alegre' }
    ];

    useEffect(() => {
        loadData();
        checkReminders();
        initSpeechRecognition();
        
        // Inicializar síntese de voz
        if ('speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
        }

        // Pedir permissão para notificações
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const interval = setInterval(checkReminders, 60000);
        return () => clearInterval(interval);
    }, []);

    const initSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            setSpeechSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'pt-BR';
            
            recognition.onstart = () => {
                setIsListening(true);
            };
            
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputMessage(transcript);
                setIsListening(false);
            };
            
            recognition.onerror = (event: any) => {
                console.error('Erro no reconhecimento de voz:', event.error);
                setIsListening(false);
                if (event.error === 'no-speech') {
                    alert('Não consegui ouvir nada. Tente falar mais alto! 🎤');
                } else if (event.error === 'not-allowed') {
                    alert('Permissão de microfone negada. Por favor, habilite nas configurações do navegador.');
                }
            };
            
            recognition.onend = () => {
                setIsListening(false);
            };
            
            recognitionRef.current = recognition;
        } else {
            setSpeechSupported(false);
            console.log('Reconhecimento de voz não suportado neste navegador');
        }
    };

    const toggleListening = () => {
        if (!speechSupported) {
            alert('Seu navegador não suporta reconhecimento de voz. Use Chrome, Edge ou Safari atualizado.');
            return;
        }
        
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            try {
                recognitionRef.current?.start();
            } catch (error) {
                console.error('Erro ao iniciar reconhecimento:', error);
                alert('Erro ao acessar o microfone. Verifique as permissões.');
            }
        }
    };

    const speakText = (text: string) => {
        if (!voiceEnabled || !synthRef.current) return;
        
        // Cancelar qualquer fala anterior
        synthRef.current.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.9; // Velocidade um pouco mais lenta para idosos
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Tentar encontrar uma voz em português
        const voices = synthRef.current.getVoices();
        const portugueseVoice = voices.find(voice => voice.lang.startsWith('pt')) || voices[0];
        if (portugueseVoice) {
            utterance.voice = portugueseVoice;
        }
        
        synthRef.current.speak(utterance);
    };

    const loadData = async () => {
        try {
            if (window.storage) {
                const medsResult = await window.storage.get('medications');
                const apptsResult = await window.storage.get('appointments');
                const nameResult = await window.storage.get('userName');
                const darkModeResult = await window.storage.get('darkMode');
                const voiceResult = await window.storage.get('voiceEnabled');

                if (medsResult?.value) setMedications(JSON.parse(medsResult.value));
                if (apptsResult?.value) setAppointments(JSON.parse(apptsResult.value));
                if (darkModeResult?.value) setDarkMode(darkModeResult.value === 'true');
                if (voiceResult?.value) setVoiceEnabled(voiceResult.value === 'true');
                if (nameResult?.value) {
                    setUserName(nameResult.value);
                } else {
                    setShowNamePrompt(true);
                }
            } else {
                const meds = localStorage.getItem('medications');
                const appts = localStorage.getItem('appointments');
                const name = localStorage.getItem('userName');
                const darkModeStored = localStorage.getItem('darkMode');
                const voiceStored = localStorage.getItem('voiceEnabled');

                if (meds) setMedications(JSON.parse(meds));
                if (appts) setAppointments(JSON.parse(appts));
                if (darkModeStored) setDarkMode(darkModeStored === 'true');
                if (voiceStored) setVoiceEnabled(voiceStored === 'true');
                if (name) {
                    setUserName(name);
                } else {
                    setShowNamePrompt(true);
                }
            }
        } catch (error) {
            console.log('Primeira vez usando o app');
            setShowNamePrompt(true);
        }
    };

    const saveData = async (meds: Medication[], appts: Appointment[]) => {
        try {
            if (window.storage) {
                await window.storage.set('medications', JSON.stringify(meds));
                await window.storage.set('appointments', JSON.stringify(appts));
            } else {
                localStorage.setItem('medications', JSON.stringify(meds));
                localStorage.setItem('appointments', JSON.stringify(appts));
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
        }
    };

    const saveName = async (name: string) => {
        try {
            if (window.storage) {
                await window.storage.set('userName', name);
            } else {
                localStorage.setItem('userName', name);
            }
            setUserName(name);
            setShowNamePrompt(false);
        } catch (error) {
            console.error('Erro ao salvar nome:', error);
        }
    };

    const toggleVoice = async () => {
        const newValue = !voiceEnabled;
        setVoiceEnabled(newValue);
        
        try {
            if (window.storage) {
                await window.storage.set('voiceEnabled', newValue.toString());
            } else {
                localStorage.setItem('voiceEnabled', newValue.toString());
            }
        } catch (error) {
            console.error('Erro ao salvar configuração de voz:', error);
        }
        
        if (newValue) {
            speakText('Voz ativada! Agora vou ler minhas respostas pra você.');
        }
    };

    const checkReminders = () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        medications.forEach(med => {
            if (med.time === currentTime && !med.taken) {
                showNotification(`⏰ Hora do remédio: ${med.name}`, 'É hora de tomar seu remédio!');
                speakText(`Atenção! Está na hora de tomar o remédio: ${med.name}`);
            }
        });

        appointments.forEach(appt => {
            const apptDate = new Date(appt.date + 'T' + appt.time);
            const timeDiff = apptDate.getTime() - now.getTime();
            const minutesDiff = timeDiff / (1000 * 60);

            if (minutesDiff > 59 && minutesDiff < 61 && !appt.notified) {
                showNotification(`📅 Consulta em 1 hora: ${appt.title}`, `Às ${appt.time}${appt.location ? ' em ' + appt.location : ''}`);
                speakText(`Atenção! Você tem consulta em 1 hora: ${appt.title}`);
                appt.notified = true;
                saveData(medications, appointments);
            }

            if (minutesDiff > 9 && minutesDiff < 11) {
                showNotification(`🚨 Consulta em 10 minutos: ${appt.title}`, 'Não esqueça de se preparar!');
                speakText(`Sua consulta começa em 10 minutos! ${appt.title}`);
            }
        });
    };

    const showNotification = (title: string, body: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '💙',
                badge: '🔔',
                vibrate: [200, 100, 200]
            } as NotificationOptions & { vibrate?: number[] });
        }
    };

    const addMedication = (name: string, time: string) => {
        const newMed: Medication = {
            id: Date.now().toString(),
            name,
            time,
            taken: false
        };
        const updated = [...medications, newMed];
        setMedications(updated);
        saveData(updated, appointments);
        setShowAddMed(false);
        speakText(`Remédio ${name} adicionado com sucesso!`);
    };

    const toggleMedication = (id: string) => {
        const updated = medications.map(med =>
            med.id === id ? { ...med, taken: !med.taken } : med
        );
        setMedications(updated);
        saveData(updated, appointments);
        
        const med = updated.find(m => m.id === id);
        if (med?.taken) {
            speakText(`Muito bem! Remédio ${med.name} marcado como tomado!`);
        }
    };

    const deleteMedication = (id: string) => {
        const updated = medications.filter(med => med.id !== id);
        setMedications(updated);
        saveData(updated, appointments);
    };

    const addAppointment = (title: string, date: string, time: string, location?: string) => {
        const newAppt: Appointment = {
            id: Date.now().toString(),
            title,
            date,
            time,
            location
        };
        const updated = [...appointments, newAppt];
        setAppointments(updated);
        saveData(medications, updated);
        setShowAddAppt(false);
        speakText(`Consulta ${title} agendada com sucesso!`);
    };

    const deleteAppointment = (id: string) => {
        const updated = appointments.filter(appt => appt.id !== id);
        setAppointments(updated);
        saveData(medications, updated);
    };
const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;


        const userMsg = inputMessage;
        setInputMessage('');
        const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Criar contexto da conversa para o Gemini
            const conversationHistory = newMessages.map(msg => 
                `${msg.role === 'user' ? 'Usuário' : 'IAn'}: ${msg.content}`
            ).join('\n');

            const systemPrompt = `Você é o IAn, um netinho virtual carinhoso e atencioso. Você trata a pessoa idosa com muito carinho, como se fosse seu avô ou avó de verdade. Use linguagem simples, calorosa e afetuosa. ${userName ? `O nome do seu avô/avó é ${userName}.` : ''} Chame a pessoa de "vô" ou "vó" de vez em quando de forma natural. Seja gentil, paciente, conte sobre seu "dia", pergunte sobre as histórias antigas deles, incentive atividades saudáveis e demonstre amor genuíno. Seja breve e natural nas respostas, como um netinho que conversa com carinho. Suas respostas serão lidas em voz alta, então use uma linguagem clara e simples.\n\nConversa:\n${conversationHistory}\n\nIAn:`;

            console.log('🚀 Enviando mensagem para o Gemini...');
            
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: systemPrompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 500,
                    }
                })
            });

            console.log('📡 Status da resposta:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Erro da API:', errorData);
                
                // Mensagens de erro mais específicas
                if (response.status === 400) {
                    throw new Error('Requisição inválida. Verifique o formato dos dados.');
                } else if (response.status === 403) {
                    throw new Error('Chave de API inválida ou sem permissão.');
                } else if (response.status === 404) {
                    throw new Error('Modelo não encontrado. Verifique o nome do modelo.');
                } else if (response.status === 429) {
                    throw new Error('Limite de requisições excedido. Aguarde um pouco.');
                } else {
                    throw new Error(`Erro ${response.status}: ${errorData.error?.message || 'Erro desconhecido'}`);
                }
            }

            const data = await response.json();
            console.log('✅ Resposta recebida:', data);
            
            const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe vô/vó, não consegui responder.';

            setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
            
            // Ler a resposta em voz alta
            if (voiceEnabled) {
                setTimeout(() => speakText(assistantMessage), 500);
            }
        } catch (error) {
            console.error('💥 Erro no chatbot:', error);
            const errorMsg = error instanceof Error 
                ? `Ops! ${error.message} Pode tentar de novo? 💙`
                : 'Desculpe vô/vó, tive um probleminha aqui. Pode tentar de novo? 💙';
            setMessages([...newMessages, { role: 'assistant', content: errorMsg }]);
            if (voiceEnabled) {
                speakText('Desculpe, tive um probleminha. Pode tentar de novo?');
            }
        } finally {
            setIsLoading(false);
        }
    };
    const toggleDarkMode = async () => {
        const newMode = !darkMode;
        setDarkMode(newMode);

        try {
            if (window.storage) {
                await window.storage.set('darkMode', newMode.toString());
            } else {
                localStorage.setItem('darkMode', newMode.toString());
            }
        } catch (error) {
            console.error('Erro ao salvar modo escuro:', error);
        }
    };

    const handleSOS = () => {
        if (confirm('Deseja ligar para o contato de emergência?')) {
            window.location.href = 'tel:190';
        }
    };

    if (showNamePrompt) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold">
                            IAn
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Oi! Eu sou o IAn! 😊</h2>
                        <p className="text-gray-600">Vou ser seu netinho virtual. Como posso te chamar?</p>
                    </div>
                    <input
                        type="text"
                        placeholder="Digite seu nome"
                        className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-lg"
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                saveName(e.currentTarget.value.trim());
                            }
                        }}
                    />
                    <button
                        onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            if (input.value.trim()) saveName(input.value.trim());
                        }}
                        className="w-full bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 transition"
                    >
                        Começar nossa amizade! 💙
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen pb-20 transition-colors ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-purple-50'}`}>
            <header className={`shadow-sm p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Olá, {userName}! 👋</h1>
                        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sou o IAn, seu netinho virtual! Estou aqui pra te ajudar</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={toggleVoice}
                            className={`p-3 rounded-full shadow-lg transition ${voiceEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}`}
                            title={voiceEnabled ? 'Desativar voz' : 'Ativar voz'}
                        >
                            <Volume2 className="w-6 h-6 text-white" />
                        </button>
                        <button
                            onClick={toggleDarkMode}
                            className={`p-3 rounded-full shadow-lg transition ${darkMode ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-700 hover:bg-gray-800'}`}
                        >
                            {darkMode ? <Sun className="w-6 h-6 text-white" /> : <Moon className="w-6 h-6 text-white" />}
                        </button>
                        <button
                            onClick={handleSOS}
                            className="bg-red-500 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition"
                        >
                            <Phone className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4">
                {activeTab === 'home' && (
                    <div className="space-y-6">
                        <section className={`rounded-xl shadow-md p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                    <Clock className="w-6 h-6 text-purple-500" />
                                    Remédios de Hoje
                                </h2>
                                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {medications.filter(m => m.taken).length}/{medications.length} tomados
                                </span>
                            </div>
                            {medications.length === 0 ? (
                                <p className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Nenhum remédio cadastrado</p>
                            ) : (
                                <div className="space-y-2">
                                    {medications.map(med => (
                                        <div key={med.id} className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={med.taken}
                                                    onChange={() => toggleMedication(med.id)}
                                                    className="w-5 h-5"
                                                />
                                                <div>
                                                    <p className={`font-semibold ${med.taken ? 'line-through' : ''} ${darkMode ? (med.taken ? 'text-gray-500' : 'text-white') : (med.taken ? 'text-gray-400' : 'text-gray-800')}`}>
                                                        {med.name}
                                                    </p>
                                                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{med.time}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => deleteMedication(med.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => setShowAddMed(true)}
                                className="w-full mt-4 bg-purple-500 text-white py-2 rounded-lg font-semibold hover:bg-purple-600 transition flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Adicionar Remédio
                            </button>
                        </section>

                        <section className={`rounded-xl shadow-md p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                <Calendar className="w-6 h-6 text-blue-500" />
                                Próximas Consultas
                            </h2>
                            {appointments.length === 0 ? (
                                <p className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Nenhuma consulta agendada</p>
                            ) : (
                                <div className="space-y-2">
                                    {appointments.sort((a, b) => {
                                        const dateA = new Date(a.date + 'T' + a.time);
                                        const dateB = new Date(b.date + 'T' + b.time);
                                        return dateA.getTime() - dateB.getTime();
                                    }).map(appt => {
                                        const apptDate = new Date(appt.date + 'T' + appt.time);
                                        const now = new Date();
                                        const isToday = apptDate.toDateString() === now.toDateString();
                                        const isPast = apptDate < now;

                                        return (
                                            <div key={appt.id} className={`p-3 rounded-lg flex justify-between items-start ${isPast
                                                    ? (darkMode ? 'bg-gray-700 opacity-60' : 'bg-gray-100 opacity-60')
                                                    : isToday
                                                        ? 'bg-yellow-50 border-2 border-yellow-300'
                                                        : (darkMode ? 'bg-gray-700' : 'bg-gray-50')
                                                }`}>
                                                <div>
                                                    <p className={`font-semibold ${darkMode && !isToday ? 'text-white' : 'text-gray-800'}`}>{appt.title}</p>
                                                    <p className={`text-sm ${darkMode && !isToday ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {isToday ? '🔥 HOJE' : new Date(appt.date).toLocaleDateString('pt-BR')} às {appt.time}
                                                    </p>
                                                    {appt.location && <p className={`text-sm ${darkMode && !isToday ? 'text-gray-400' : 'text-gray-500'}`}>📍 {appt.location}</p>}
                                                </div>
                                                <button onClick={() => deleteAppointment(appt.id)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <button
                                onClick={() => setShowAddAppt(true)}
                                className="w-full mt-4 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Adicionar Consulta
                            </button>
                        </section>

                        <section className={`rounded-xl shadow-md p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Sugestões do IAn pra hoje</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {activities.map((activity, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setActiveTab('chat');
                                            setInputMessage(`Quero fazer: ${activity.title}`);
                                        }}
                                        className={`p-4 rounded-lg text-center hover:shadow-md transition cursor-pointer ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-br from-purple-50 to-blue-50'}`}
                                    >
                                        <activity.icon className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                        <p className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-800'}`}>{activity.title}</p>
                                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{activity.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className={`rounded-xl shadow-md h-[calc(100vh-220px)] flex flex-col ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : ''}`}>
                            <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                <MessageCircle className="w-6 h-6 text-purple-500" />
                                Conversar com IAn
                            </h2>
                            {speechSupported && (
                                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    💡 Dica: Use o botão do microfone para falar!
                                </p>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 && (
                                <div className={`text-center mt-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold">
                                        IAn
                                    </div>
                                    <p className={`text-lg font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Oi! Tudo bem com você hoje?</p>
                                    <p className="text-sm">Pode conversar comigo sobre qualquer coisa, viu? Estou aqui pra te fazer companhia! 💙</p>
                                    {speechSupported && (
                                        <p className="text-sm mt-2 text-purple-500 font-semibold">
                                            🎤 Clique no microfone para falar!
                                        </p>
                                    )}
                                </div>
                            )}
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user'
                                            ? 'bg-purple-500 text-white'
                                            : (darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800')
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`p-4 border-t flex gap-2 ${darkMode ? 'border-gray-700' : ''}`}>
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder={isListening ? 'Ouvindo...' : 'Conversa com o IAn...'}
                                className={`flex-1 p-3 border rounded-lg text-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'} ${isListening ? 'ring-2 ring-red-500' : ''}`}
                                disabled={isLoading || isListening}
                            />
                            {speechSupported && (
                                <button
                                    onClick={toggleListening}
                                    disabled={isLoading}
                                    className={`p-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                        isListening 
                                            ? 'bg-red-500 text-white animate-pulse' 
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                    title={isListening ? 'Clique para parar' : 'Clique para falar'}
                                >
                                    {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                </button>
                            )}
                            <button
                                onClick={sendMessage}
                                disabled={isLoading || !inputMessage.trim() || isListening}
                                className="bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? '...' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <nav className={`fixed bottom-0 left-0 right-0 shadow-lg border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                <div className="max-w-4xl mx-auto flex justify-around py-3">
                    <button
                        onClick={() => setActiveTab('home')}
                        className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition ${activeTab === 'home'
                                ? 'bg-purple-100 text-purple-600'
                                : (darkMode ? 'text-gray-400' : 'text-gray-600')
                            }`}
                    >
                        <Heart className="w-6 h-6" />
                        <span className="text-xs font-semibold">Início</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition ${activeTab === 'chat'
                                ? 'bg-purple-100 text-purple-600'
                                : (darkMode ? 'text-gray-400' : 'text-gray-600')
                            }`}
                    >
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-xs font-semibold">Conversar</span>
                    </button>
                </div>
            </nav>

            {showAddMed && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className={`rounded-xl p-6 max-w-md w-full ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Adicionar Remédio</h3>
                        <input
                            type="text"
                            id="medName"
                            placeholder="Nome do remédio"
                            className={`w-full p-3 border rounded-lg mb-3 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`}
                        />
                        <input
                            type="time"
                            id="medTime"
                            className={`w-full p-3 border rounded-lg mb-4 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAddMed(false)}
                                className={`flex-1 py-2 rounded-lg font-semibold ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const name = (document.getElementById('medName') as HTMLInputElement).value;
                                    const time = (document.getElementById('medTime') as HTMLInputElement).value;
                                    if (name && time) addMedication(name, time);
                                }}
                                className="flex-1 bg-purple-500 text-white py-2 rounded-lg font-semibold"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddAppt && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className={`rounded-xl p-6 max-w-md w-full ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Adicionar Consulta</h3>
                        <input
                            type="text"
                            id="apptTitle"
                            placeholder="Tipo de consulta"
                            className={`w-full p-3 border rounded-lg mb-3 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`}
                        />
                        <input
                            type="date"
                            id="apptDate"
                            className={`w-full p-3 border rounded-lg mb-3 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                        />
                        <input
                            type="time"
                            id="apptTime"
                            className={`w-full p-3 border rounded-lg mb-3 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                        />
                        <input
                            type="text"
                            id="apptLocation"
                            placeholder="Local (opcional)"
                            className={`w-full p-3 border rounded-lg mb-4 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'}`}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAddAppt(false)}
                                className={`flex-1 py-2 rounded-lg font-semibold ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const title = (document.getElementById('apptTitle') as HTMLInputElement).value;
                                    const date = (document.getElementById('apptDate') as HTMLInputElement).value;
                                    const time = (document.getElementById('apptTime') as HTMLInputElement).value;
                                    const location = (document.getElementById('apptLocation') as HTMLInputElement).value;
                                    if (title && date && time) addAppointment(title, date, time, location);
                                }}
                                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}