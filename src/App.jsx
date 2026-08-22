import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, HelpCircle, Crosshair, Lightbulb, Users, ShieldAlert, User, Check, X, SkipForward, Loader2, Trophy, ArrowRight, Flag, Dices, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';

const fuzzyMatch = (str1, str2) => {
  const s1 = (str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = (str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return true;
  if (s1.length < 3 || s2.length < 3) return false;
  return s1.includes(s2) || s2.includes(s1); 
};

export default function App() {
  const [gameState, setGameState] = useState('lobby'); 
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);

  const [turnAction, setTurnAction] = useState('question');
  const [inputText, setInputText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState(null);

  const [secretCharacter, setSecretCharacter] = useState('');
  const [startingHint, setStartingHint] = useState('');
  const [pointsAvailable, setPointsAvailable] = useState(10);
  const [showWinnerPopup, setShowWinnerPopup] = useState(null);
  
  const [history, setHistory] = useState([]);
  const [players, setPlayers] = useState([]);

  const myPlayer = players.find(p => p.id === myPlayerId) || {};
  const currentTarget = players.find(p => p.is_target) || {};
  const currentPlayer = players.find(p => p.is_current_turn) || {};
  const hasSecretAccess = myPlayer.is_target || myPlayer.has_guessed_correctly || myPlayer.is_eliminated;

  useEffect(() => {
    const storedRoomId = sessionStorage.getItem('gw_roomId');
    const storedPlayerId = sessionStorage.getItem('gw_playerId');

    if (storedRoomId && storedPlayerId) {
      supabase.from('players').select('*').eq('id', storedPlayerId).single().then(({ data: player }) => {
        if (player) {
          setCurrentRoomId(storedRoomId);
          setMyPlayerId(storedPlayerId);
        } else {
          sessionStorage.clear();
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!currentRoomId) return;

    fetchRoomState(currentRoomId);

    const roomChannel = supabase.channel(`room-${currentRoomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoomId}` }, (payload) => {
        setGameState(payload.new.status);
        setPointsAvailable(payload.new.points_available);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${currentRoomId}` }, () => {
        fetchPlayers(currentRoomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs', filter: `room_id=eq.${currentRoomId}` }, (payload) => {
        if (payload.new.log_type === 'guess' && payload.new.is_correct) {
          setShowWinnerPopup(payload.new.player_name);
          setTimeout(() => setShowWinnerPopup(null), 3500);
        }
        fetchLogs(currentRoomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'logs', filter: `room_id=eq.${currentRoomId}` }, () => {
        fetchLogs(currentRoomId);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'logs', filter: `room_id=eq.${currentRoomId}` }, () => {
        fetchLogs(currentRoomId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [currentRoomId]);

  const fetchRoomState = async (roomId) => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (room) {
      setGameState(room.status);
      setPointsAvailable(room.points_available);
    }
    fetchPlayers(roomId);
    fetchLogs(roomId);
  };

  const fetchPlayers = async (roomId) => {
    const { data } = await supabase.from('players').select('*').order('joined_at', { ascending: true });
    if (data) setPlayers(data.filter(p => p.room_id === roomId));
  };

  const fetchLogs = async (roomId) => {
    const { data } = await supabase.from('logs').select('*').order('created_at', { ascending: true });
    if (data) {
      const formatted = data.filter(l => l.room_id === roomId).map(l => ({
        type: l.log_type,
        text: l.log_text,
        answer: l.answer,
        player: l.player_name,
        actualGuess: l.actual_guess,
        isCorrect: l.is_correct
      }));
      setHistory(formatted);
      const latestQ = formatted.slice().reverse().find(l => l.type === 'question' && !l.answer);
      setPendingQuestion(latestQ ? latestQ.text : null);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setRoomCode(code);
  };

  const handleCreateOrJoinRoom = async () => {
    if (!roomCode.trim() || !playerName.trim()) return;
    const code = roomCode.toUpperCase().trim();

    try {
      let { data: room } = await supabase.from('rooms').select('*').eq('code', code).single();

      if (!room) {
        const { data: newRoom, error: createError } = await supabase.from('rooms').insert([{ code, status: 'draft', points_available: 10 }]).select().single();
        if (createError) throw new Error("Failed to create room: " + createError.message);
        room = newRoom;
      }

      const { data: existingPlayers } = await supabase.from('players').select('id').eq('room_id', room.id);
      const isFirstPlayer = existingPlayers.length === 0;

      if (isFirstPlayer && room.status !== 'draft') {
        await supabase.from('rooms').update({ status: 'draft', points_available: 10 }).eq('id', room.id);
        await supabase.from('logs').delete().eq('room_id', room.id);
        room.status = 'draft';
      }

      setCurrentRoomId(room.id);
      setGameState(room.status);

      const { data: newPlayer, error: playerError } = await supabase.from('players').insert([{
        room_id: room.id,
        name: playerName.trim(),
        is_current_turn: isFirstPlayer, 
        is_target: isFirstPlayer,       
        score: 0,
        is_eliminated: false,
        can_guess: true
      }]).select().single();

      if (playerError) throw new Error("Failed to join room: " + playerError.message);

      setMyPlayerId(newPlayer.id);
      sessionStorage.setItem('gw_roomId', room.id);
      sessionStorage.setItem('gw_playerId', newPlayer.id);
      
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not connect to Supabase.");
    }
  };

  const handleLeaveRoom = async () => {
    if (myPlayerId) await supabase.from('players').delete().eq('id', myPlayerId);
    sessionStorage.clear();
    setGameState('lobby');
    setCurrentRoomId(null);
    setMyPlayerId(null);
    setPlayers([]);
    setHistory([]);
  };

  const handleLockIn = async () => {
    if (!secretCharacter.trim() || players.length < 2) return;

    await supabase.from('players').update({ secret_character: secretCharacter, starting_hint: startingHint }).eq('id', myPlayerId);
    if (startingHint.trim()) {
      await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'hint', log_text: startingHint }]);
    }
    
    const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
    
    const firstInterrogator = freshPlayers.find(p => !p.is_target);
    if (firstInterrogator) {
      await supabase.from('players').update({ is_current_turn: false }).eq('room_id', currentRoomId); 
      await supabase.from('players').update({ is_current_turn: true }).eq('id', firstInterrogator.id); 
    }

    await supabase.from('rooms').update({ status: 'playing' }).eq('id', currentRoomId);
  };

  const handleActionSubmit = async () => {
    if (!inputText.trim()) return;

    if (turnAction === 'question') {
      await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'question', log_text: inputText, player_name: myPlayer.name }]);
      setInputText('');
    } else {
      const isCorrect = fuzzyMatch(inputText, currentTarget.secret_character);
      
      if (isCorrect) {
        await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'guess', player_name: myPlayer.name, actual_guess: inputText, is_correct: true }]);
        await supabase.from('players').update({ has_guessed_correctly: true, score: myPlayer.score + pointsAvailable }).eq('id', myPlayerId);
        
        const nextPoints = pointsAvailable === 10 ? 5 : pointsAvailable === 5 ? 3 : 1;
        await supabase.from('rooms').update({ points_available: nextPoints }).eq('id', currentRoomId);
        
        setInputText('');
        checkRoundEnd();
      } else {
        await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'guess', player_name: myPlayer.name, actual_guess: inputText, is_correct: false }]);
        setInputText('');
        setTurnAction('question');
        advanceTurn(); 
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleActionSubmit();
  };

  const handleAnswerSubmit = async (answer) => {
    const latestQ = history.slice().reverse().find(l => l.type === 'question' && !l.answer);
    if (latestQ) {
      await supabase.from('logs').update({ answer }).eq('room_id', currentRoomId).eq('log_text', latestQ.text);
    }
    setPendingQuestion(null);
    advanceTurn();
  };

  const handleSkip = async () => {
    const latestQ = history.slice().reverse().find(l => l.type === 'question' && !l.answer);
    if (latestQ) {
      await supabase.from('logs').update({ answer: 'Skipped by Target (Try another question)' }).eq('room_id', currentRoomId).eq('log_text', latestQ.text);
    }
    setPendingQuestion(null);
  };

  const handleTapOut = async () => {
    await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'tap_out', player_name: myPlayer.name, log_text: 'Tapped out' }]);
    await supabase.from('players').update({ is_eliminated: true }).eq('id', myPlayerId);

    const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
    
    const activeInterrogators = freshPlayers.filter(p => !p.is_target && !p.is_eliminated);
    const allFinished = activeInterrogators.every(p => p.has_guessed_correctly);

    if (allFinished || activeInterrogators.length === 0) {
      await supabase.from('rooms').update({ status: 'scoreboard' }).eq('id', currentRoomId);
    } else {
      if (myPlayer.is_current_turn) advanceTurn(freshPlayers);
    }
  };

  const checkRoundEnd = async () => {
    const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
    const activeInterrogators = freshPlayers.filter(p => !p.is_target && !p.is_eliminated);
    const allFinished = activeInterrogators.every(p => p.has_guessed_correctly);

    if (allFinished || activeInterrogators.length === 0) {
      await supabase.from('rooms').update({ status: 'scoreboard' }).eq('id', currentRoomId);
    } else {
      advanceTurn(freshPlayers);
    }
  };

  const advanceTurn = async (playersList = null) => {
    let freshList = playersList;
    if (!freshList) {
      const { data } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
      freshList = data;
    }

    const currentIndex = freshList.findIndex(p => p.is_current_turn);
    if (currentIndex === -1) return; 
    
    let nextIndex = (currentIndex + 1) % freshList.length;
    let loop = 0;
    while ((freshList[nextIndex].is_target || freshList[nextIndex].has_guessed_correctly || freshList[nextIndex].is_eliminated) && loop < freshList.length) {
      nextIndex = (nextIndex + 1) % freshList.length;
      loop++;
    }

    await supabase.from('players').update({ is_current_turn: false }).eq('id', freshList[currentIndex].id);
    await supabase.from('players').update({ is_current_turn: true }).eq('id', freshList[nextIndex].id);
  };

  const handleNextRound = async () => {
    const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
    
    const targetIdx = freshPlayers.findIndex(p => p.is_target);
    const nextTargetIdx = (targetIdx + 1) % freshPlayers.length;

    await supabase.from('rooms').update({ status: 'draft', points_available: 10 }).eq('id', currentRoomId);
    await supabase.from('logs').delete().eq('room_id', currentRoomId);

    for (let p of freshPlayers) {
      await supabase.from('players').update({
        has_guessed_correctly: false,
        is_eliminated: false,
        can_guess: true,
        is_target: p.id === freshPlayers[nextTargetIdx].id,
        is_current_turn: p.id === freshPlayers[nextTargetIdx].id 
      }).eq('id', p.id);
    }

    setGameState('draft');
    setSecretCharacter('');
    setStartingHint('');
    setTurnAction('question');
    setHistory([]);
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col relative">
      <header className="w-full p-4 md:p-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <HelpCircle className="text-indigo-500" size={24} />
          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-400 tracking-wider">
            GUESS WHO: ARENA
          </span>
        </div>
        <div className="flex gap-3">
          {currentRoomId && (
            <button onClick={handleLeaveRoom} className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-sm font-bold px-4 py-2 rounded-lg transition-colors border border-rose-800/50 flex items-center gap-2">
              <LogOut size={16} /> Leave Match
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showWinnerPopup && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-none">
            <div className="bg-emerald-950/40 border-2 border-emerald-500/50 p-10 rounded-3xl text-center shadow-[0_0_80px_rgba(16,185,129,0.2)]">
              <h1 className="text-4xl md:text-6xl font-bold text-emerald-400 mb-4 tracking-tight">Target Acquired</h1>
              <p className="text-xl md:text-3xl text-emerald-100 font-medium"><span className="text-white font-bold">{showWinnerPopup}</span> figured it out!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {gameState === 'lobby' && (
            <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2rem] p-8 shadow-2xl flex flex-col space-y-6 relative z-10">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-400">Join Match</h1>
                <p className="text-gray-400">Enter the room code to join your friends.</p>
              </div>
              <div className="space-y-4">
                <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your Name" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 focus:border-indigo-500 focus:outline-none text-lg text-center font-bold tracking-wider" />
                
                <div className="relative">
                  <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Room Code (e.g. ABCD)" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 focus:border-indigo-500 focus:outline-none text-lg text-center font-bold tracking-widest uppercase" />
                  <button onClick={generateRandomCode} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 p-2 transition-colors" title="Generate Random Code">
                    <Dices size={20} />
                  </button>
                </div>
              </div>
              <button onClick={handleCreateOrJoinRoom} disabled={!roomCode || !playerName} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2">
                <Users size={20} /> Enter Arena
              </button>
            </motion.div>
          )}

          {gameState === 'draft' && (
            <motion.div key="draft" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2rem] p-8 shadow-2xl flex flex-col space-y-6 relative z-10">
              <div className="text-center space-y-2 border-b border-neutral-800 pb-6">
                <ShieldAlert size={40} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-3xl font-bold">
                  {myPlayer.id === currentTarget.id ? "You are in the Hot Seat." : `${currentTarget.name} is in the Hot Seat.`}
                </h2>
                <p className="text-gray-400">Waiting for target to lock in character...</p>
              </div>
              
              {myPlayer.id === currentTarget.id ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block uppercase tracking-wider font-bold">Character Name</label>
                    <input type="text" value={secretCharacter} onChange={(e) => setSecretCharacter(e.target.value)} placeholder="e.g., Gordon Ramsay" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 focus:border-rose-500 focus:outline-none text-lg" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block uppercase tracking-wider font-bold">Starting Hint (Optional)</label>
                    <input type="text" value={startingHint} onChange={(e) => setStartingHint(e.target.value)} placeholder="e.g., Known for being angry." className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 focus:border-rose-500 focus:outline-none" />
                  </div>
                  <button onClick={handleLockIn} disabled={!secretCharacter || players.length < 2} className="w-full font-bold py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {players.length < 2 ? "Waiting for players to join..." : "Lock In Target"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-gray-500">
                   <Loader2 className="animate-spin" size={32} />
                   <p className="text-xl uppercase tracking-widest font-bold">Waiting for {currentTarget.name}...</p>
                </div>
              )}
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md md:max-w-none md:w-[95vw] lg:w-[90vw] 2xl:max-w-[1500px] bg-neutral-900 border border-neutral-800 rounded-3xl md:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[82vh] relative z-10">
              <div className="md:p-6 lg:p-8 border-b md:border-b-0 md:border-r border-neutral-800 bg-neutral-900/80 backdrop-blur-sm flex md:flex-col justify-between items-start md:w-80 lg:w-96 flex-shrink-0 z-10 h-auto md:h-full">
                <div className="w-full flex flex-col">
                  <div className="w-full flex border-b border-neutral-800 mb-4 bg-neutral-950/50 rounded-t-xl overflow-hidden px-4 py-3 items-center justify-center gap-2 text-indigo-400 font-bold uppercase tracking-widest text-xs">
                    <Lightbulb size={14} /> Intel Log
                  </div>
                  
                  <div className="flex flex-col space-y-3 w-full max-h-32 md:max-h-[50vh] overflow-y-auto px-4 md:px-0 pr-2 scrollbar-hide">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Live Activity</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Bounty: {pointsAvailable}pts</span>
                    </div>
                    {history.map((log, i) => (
                      <div key={`intel-${i}`} className="text-xs md:text-sm bg-neutral-800/50 p-3 rounded-xl border border-neutral-700/50">
                        {log.type === 'hint' && <span className="text-emerald-400 font-medium">{log.text}</span>}
                        {log.type === 'question' && (
                          <div className="space-y-1.5">
                            <span className="text-gray-300 block">Q: {log.text}</span>
                            <span className={log.answer?.includes('Yes') ? 'text-emerald-400 font-bold block' : log.answer?.includes('No') ? 'text-rose-400 font-bold block' : 'text-gray-500 font-bold block'}>A: {log.answer || 'Pending...'}</span>
                          </div>
                        )}
                        {log.type === 'guess' && (
                          <div>
                            {log.isCorrect ? (
                              <span className="text-emerald-400 font-bold">✅ {log.player} guessed correctly!</span>
                            ) : hasSecretAccess ? (
                              <span className="text-rose-400 font-bold">❌ {log.player} guessed: "{log.actualGuess}"</span>
                            ) : (
                              <span className="text-gray-500 italic">❌ {log.player} guessed incorrectly.</span>
                            )}
                          </div>
                        )}
                        {log.type === 'tap_out' && (
                          <div><span className="text-gray-500 italic">🏳️ {log.player} gave up and tapped out.</span></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {!myPlayer.has_guessed_correctly && !myPlayer.is_target && !myPlayer.is_eliminated && (
                  <div className="w-full pt-4 mt-4 border-t border-neutral-800">
                    <button onClick={handleTapOut} className="w-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                      <Flag size={14} /> Tap Out (Give Up)
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-grow flex flex-col relative h-full bg-neutral-950/50 overflow-hidden">
                <div className="w-full bg-neutral-900/50 border-b border-neutral-800 p-4 overflow-x-auto">
                  <div className="flex items-center justify-center gap-4 md:gap-6 min-w-max px-4">
                    {players.map((player) => (
                      <div key={player.id} className={`flex flex-col items-center gap-2 ${player.has_guessed_correctly || player.is_eliminated ? 'opacity-50' : 'opacity-100'}`}>
                        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center border-2 relative ${player.is_eliminated ? 'border-rose-500 bg-rose-500/10' : player.has_guessed_correctly ? 'border-emerald-500 bg-emerald-500/10' : player.is_current_turn ? 'border-indigo-500 bg-indigo-500/10' : player.is_target ? 'border-rose-500 bg-rose-500/10' : 'border-neutral-700 bg-neutral-800'}`}>
                          {player.is_eliminated ? <X size={24} className="text-rose-500" /> : player.has_guessed_correctly ? <Check size={24} className="text-emerald-500" /> : <User size={20} />}
                          <div className="absolute -bottom-2 bg-neutral-900 text-[9px] font-bold px-1.5 py-0.5 rounded border border-neutral-700">{player.score}</div>
                        </div>
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-400">{player.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-6">
                  {!pendingQuestion ? (
                    <>
                      <div className="w-24 h-24 md:w-40 md:h-40 bg-neutral-950 rounded-full border-4 border-rose-500/50 flex items-center justify-center shadow-[0_0_60px_rgba(244,63,94,0.2)]">
                        <span className="text-4xl md:text-6xl">❓</span>
                      </div>
                      <div className="space-y-3 flex flex-col items-center">
                        <h2 className="text-2xl md:text-5xl font-bold">
                          {myPlayer.id === currentTarget.id ? (
                            <span>You are in the <span className="text-rose-500">Hot Seat</span></span>
                          ) : (
                            <span>Target: <span className="text-rose-500">{currentTarget.name}</span></span>
                          )}
                        </h2>
                        
                        {hasSecretAccess && currentTarget.secret_character && (
                           <div className="mt-2 text-rose-400 font-bold tracking-widest uppercase border border-rose-500/30 bg-rose-500/10 px-4 py-2 rounded-full text-xs">
                             Secret Character: {currentTarget.secret_character}
                           </div>
                        )}

                        <p className="text-gray-400 pt-2">
                          {myPlayer.id === currentPlayer.id && !myPlayer.is_eliminated
                            ? "It's your turn to ask a question or assassinate."
                            : `${currentPlayer.name || 'Someone'} is asking a question...`}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="max-w-3xl px-4">
                      <h2 className="text-3xl md:text-5xl font-bold text-indigo-300 leading-tight">"{pendingQuestion}"</h2>
                      <div className="mt-8 flex items-center justify-center gap-3 text-lg text-gray-400">
                        <Loader2 className="animate-spin text-rose-500" size={24} /> <span className="text-rose-500 font-bold">{currentTarget.name}</span> is answering...
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 md:p-8 bg-neutral-950 border-t border-neutral-800 z-10 flex flex-col justify-center min-h-[180px]">
                  <div className="max-w-4xl mx-auto w-full">
                    {!pendingQuestion ? (
                      myPlayer.id === currentPlayer.id && !myPlayer.is_eliminated ? (
                        <div>
                          <div className="flex w-full mb-4 bg-neutral-900 p-1.5 rounded-2xl">
                            <button onClick={() => setTurnAction('question')} className={`flex-1 py-3 text-sm font-bold rounded-xl ${turnAction === 'question' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Ask Question</button>
                            <button 
                              onClick={() => setTurnAction('guess')} 
                              className={`flex-1 py-3 text-sm font-bold rounded-xl ${turnAction === 'guess' ? 'bg-rose-600 text-white' : 'text-gray-500'}`}
                            >
                              Assassinate ({pointsAvailable}pts)
                            </button>
                          </div>
                          <div className="flex space-x-3">
                            <input 
                              type="text" 
                              value={inputText} 
                              onChange={(e) => setInputText(e.target.value)} 
                              onKeyDown={handleKeyDown} 
                              placeholder={turnAction === 'question' ? "Ask a yes/no question..." : "Guess the exact character..."} 
                              className="flex-grow bg-neutral-900 border border-neutral-800 text-white rounded-2xl px-4 py-4 focus:outline-none" 
                            />
                            <button onClick={handleActionSubmit} className="bg-white text-black font-bold px-6 py-4 rounded-2xl transition-transform active:scale-95"><Send size={24} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-neutral-500 uppercase tracking-widest font-bold">
                          {myPlayer.is_eliminated ? 'You have tapped out.' : `Waiting for ${currentPlayer.name || 'the active player'}...`}
                        </div>
                      )
                    ) : (
                      myPlayer.id === currentTarget.id ? (
                        <div className="flex gap-4 w-full justify-center">
                          <button onClick={() => handleAnswerSubmit('Yes')} className="flex-1 bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400 font-bold py-6 rounded-2xl text-2xl uppercase flex items-center justify-center gap-2 transition-transform active:scale-95"><Check size={28} /> Yes</button>
                          <button onClick={handleSkip} className="flex-[1.5] bg-neutral-800 border-2 border-neutral-600 text-gray-300 font-bold py-6 rounded-2xl text-xl uppercase flex items-center justify-center gap-2 transition-transform active:scale-95"><SkipForward size={24} /> Skip</button>
                          <button onClick={() => handleAnswerSubmit('No')} className="flex-1 bg-rose-600/20 border-2 border-rose-500 text-rose-400 font-bold py-6 rounded-2xl text-2xl uppercase flex items-center justify-center gap-2 transition-transform active:scale-95"><X size={28} /> No</button>
                        </div>
                      ) : (
                        <div className="text-center text-neutral-500 uppercase tracking-widest font-bold">Waiting for target to answer...</div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'scoreboard' && (
            <motion.div key="scoreboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2rem] p-8 shadow-2xl flex flex-col space-y-8 relative z-10">
              <div className="text-center space-y-2 border-b border-neutral-800 pb-6">
                <Trophy size={48} className="mx-auto text-amber-500 mb-4" />
                <h2 className="text-4xl font-bold">Round Over!</h2>
                <p className="text-gray-400">The secret character was: <span className="text-rose-400 font-bold">{currentTarget.secret_character}</span></p>
              </div>
              <div className="space-y-3">
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className="flex justify-between items-center p-4 rounded-xl bg-neutral-800/50 border border-neutral-700">
                    <span className="font-bold text-lg">{p.name}</span>
                    <span className="font-bold text-2xl">{p.score} pts</span>
                  </div>
                ))}
              </div>
              {myPlayer.is_target && (
                <button onClick={handleNextRound} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-xl transition-all flex justify-center items-center gap-3 text-lg">
                  Start Next Round <ArrowRight size={20} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <footer className="w-full p-4 text-center text-neutral-600 text-[10px] font-bold tracking-[0.2em] uppercase z-20">
        Made with ❤️ by <a href="https://e-z.bio/tayler" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-400 transition-colors">Tayler</a>
      </footer>
    </div>
  );
}