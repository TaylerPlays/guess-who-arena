import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, HelpCircle, Crosshair, Lightbulb, Users, ShieldAlert, User, Check, X, SkipForward, Loader2, Trophy, ArrowRight, Flag, Dices, LogOut, Info, VolumeX, SlidersHorizontal, Eye, EyeOff, Play, Pause, SkipBack, Music, Skull, Flame } from 'lucide-react';
import { supabase } from './supabaseClient';

// --- GAMING & TRAP PLAYLIST ---
const LOFI_PLAYLIST = [
  { title: "Gaming Trap Music", url: "https://cdn.pixabay.com/audio/2026/07/19/audio_a6799ee994.mp3", link: "https://pixabay.com/music/trap-game-gaming-trap-music-570137/" },
  { title: "Video Game Music", url: "https://cdn.pixabay.com/audio/2026/07/25/audio_96dc710b3e.mp3", link: "https://pixabay.com/music/orchestral-video-game-video-game-music-574163/" },
  { title: "Shooter Game Music", url: "https://cdn.pixabay.com/audio/2026/08/02/audio_e3c78771f7.mp3", link: "https://pixabay.com/music/trap-shooting-shooter-game-music-578993/" },
  { title: "Aggressive Phonk Edit", url: "https://cdn.pixabay.com/audio/2026/07/19/audio_9f9bd23ae6.mp3", link: "https://pixabay.com/music/phonk-aggressive-phonk-edit-music-570091/" },
  { title: "Aggressive Phonk Drift", url: "https://cdn.pixabay.com/audio/2026/08/09/audio_a533209cc1.mp3", link: "https://pixabay.com/music/phonk-aggressive-phonk-drift-beat-582774/" },
  { title: "Gangster Mafia Trap", url: "https://cdn.pixabay.com/audio/2026/08/02/audio_fb12b4e011.mp3", link: "https://pixabay.com/music/trap-gangster-mafia-trap-beat-579029/" },
  { title: "Horror Trap Beat", url: "https://cdn.pixabay.com/audio/2026/07/12/audio_d6dbcea3af.mp3", link: "https://pixabay.com/music/trap-horror-horror-trap-beat-566173/" },
  { title: "Criminal Gangster Beat", url: "https://cdn.pixabay.com/audio/2026/07/09/audio_762dee58d6.mp3", link: "https://pixabay.com/music/trap-criminal-gangster-beat-beats-564493/" }
];

// Global Audio Context 
const audioContext = {
  success: new Audio('https://cdnjs.cloudflare.com/ajax/libs/ion-sound/3.0.7/sounds/glass_drop.mp3'),     
  fail: new Audio('https://cdnjs.cloudflare.com/ajax/libs/ion-sound/3.0.7/sounds/branch_break.mp3'),      
  yes: new Audio('https://cdnjs.cloudflare.com/ajax/libs/ion-sound/3.0.7/sounds/button_tiny.mp3'),        
  no: new Audio('https://cdnjs.cloudflare.com/ajax/libs/ion-sound/3.0.7/sounds/door_bump.mp3'),           
  skip: new Audio('https://cdnjs.cloudflare.com/ajax/libs/ion-sound/3.0.7/sounds/water_droplet.mp3')      
};
// -------------------------------------------------------------------------

const fuzzyMatch = (str1, str2) => {
  const s1 = (str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = (str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return true;
  if (s1.length < 3 || s2.length < 3) return false;
  return s1.includes(s2) || s2.includes(s1); 
};

// --- Fading Score Animation ---
const ScoreFloater = ({ score }) => {
  const [diff, setDiff] = useState(null);
  const [prev, setPrev] = useState(score);

  useEffect(() => {
    if (score > prev) {
      setDiff(score - prev);
      setPrev(score);
    } else if (score < prev) {
      setPrev(score); 
    }
  }, [score, prev]);

  useEffect(() => {
    if (diff !== null) {
      const t = setTimeout(() => setDiff(null), 2500);
      return () => clearTimeout(t);
    }
  }, [diff]);

  return (
    <AnimatePresence>
      {diff !== null && (
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: 1, y: -45, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="absolute top-0 whitespace-nowrap text-emerald-400 font-black text-2xl z-50 pointer-events-none drop-shadow-[0_4px_4px_rgba(0,0,0,1)]"
        >
          +{diff} pts
        </motion.div>
      )}
    </AnimatePresence>
  );
};
// ------------------------------------

export default function App() {
  const [gameState, setGameState] = useState('lobby'); 
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState(null); 
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [roomModifiers, setRoomModifiers] = useState({});

  const [turnAction, setTurnAction] = useState('question');
  const [inputText, setInputText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState(null);

  const [secretCharacter, setSecretCharacter] = useState('');
  const [startingHint, setStartingHint] = useState('');
  
  // Modals & States
  const [showRules, setShowRules] = useState(false);
  const [showRoomCode, setShowRoomCode] = useState(false);
  const [showWinnerPopup, setShowWinnerPopup] = useState(null);
  const [showEfficiencyPopup, setShowEfficiencyPopup] = useState(false);
  const [efficiencyMessage, setEfficiencyMessage] = useState('');
  const [isLockingIn, setIsLockingIn] = useState(false);
  
  // --- Audio & Scrolling Refs ---
  const bgMusicRef = useRef(null);
  const audioMenuRef = useRef(null);
  const logEndRef = useRef(null);
  
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true); 
  const [bannerState, setBannerState] = useState('idle'); 
  
  const [musicVolume, setMusicVolume] = useState(0.12);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const sfxVolumeRef = useRef(0.6); 
  const [hasInteracted, setHasInteracted] = useState(false);

  // Safely auto-crop and compress uploaded profile pictures to tiny base64 strings
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150;
        
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, startX, startY, size, size, 0, 0, MAX_SIZE, MAX_SIZE);
        setPlayerAvatar(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    sfxVolumeRef.current = sfxVolume;
  }, [sfxVolume]);

  useEffect(() => {
    const audio = bgMusicRef.current;
    if (!audio) return;
    audio.volume = musicVolume;
    if (hasInteracted && isMusicPlaying && musicVolume > 0) {
      audio.play().catch(e => console.log("Play blocked by browser:", e));
    } else {
      audio.pause();
    }
  }, [currentTrackIndex, isMusicPlaying, musicVolume, hasInteracted]);

  useEffect(() => {
    if (!hasInteracted || !isMusicPlaying) {
      setBannerState('idle');
      return;
    }
    setBannerState('now-playing');
    const t1 = setTimeout(() => { setBannerState('song-name'); }, 1500);
    const t2 = setTimeout(() => { setBannerState('idle'); }, 5500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [currentTrackIndex, isMusicPlaying, hasInteracted]);

  const playSound = (type) => {
    if (sfxVolumeRef.current > 0 && audioContext[type]) {
      audioContext[type].currentTime = 0;
      audioContext[type].volume = sfxVolumeRef.current;
      audioContext[type].play().catch(() => {});
    }
  };

  const togglePlayPause = () => setIsMusicPlaying(!isMusicPlaying);
  const playNextTrack = () => setCurrentTrackIndex((prev) => (prev + 1) % LOFI_PLAYLIST.length);
  const playPreviousTrack = () => setCurrentTrackIndex((prev) => (prev - 1 + LOFI_PLAYLIST.length) % LOFI_PLAYLIST.length);

  useEffect(() => {
    const handleFirstClick = () => { if (!hasInteracted) setHasInteracted(true); };
    document.addEventListener('click', handleFirstClick, { once: true });
    return () => document.removeEventListener('click', handleFirstClick);
  }, [hasInteracted]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(event.target)) setShowAudioMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // -----------------------------------------------------

  const [history, setHistory] = useState([]);
  const [players, setPlayers] = useState([]);

  const isHost = players.length > 0 && myPlayerId === players[0].id;
  const myPlayer = players.find(p => p.id === myPlayerId) || {};
  const currentTarget = players.find(p => p.is_target) || {};
  const currentPlayer = players.find(p => p.is_current_turn) || {};
  const hasSecretAccess = myPlayer.is_target || myPlayer.has_guessed_correctly || myPlayer.is_eliminated;

  // Auto-scroll Intel Log perfectly
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

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
        setRoomModifiers(payload.new.modifiers || {});
        
        if (payload.new.status === 'draft') {
           setHistory([]);
           setPendingQuestion(null);
           setShowEfficiencyPopup(false);
           setShowWinnerPopup(null);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${currentRoomId}` }, () => {
        fetchPlayers(currentRoomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs', filter: `room_id=eq.${currentRoomId}` }, (payload) => {
        if (payload.new.log_type === 'guess' && payload.new.is_correct) {
          setShowWinnerPopup(payload.new.player_name);
          setTimeout(() => setShowWinnerPopup(null), 3500);
        }
        if (payload.new.log_type === 'system') {
          setEfficiencyMessage(payload.new.log_text);
          setShowEfficiencyPopup(true);
        }
        fetchLogs(currentRoomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'logs', filter: `room_id=eq.${currentRoomId}` }, (payload) => {
        if (payload.new.answer && (!payload.old || payload.new.answer !== payload.old.answer)) {
           if (payload.new.answer === 'Yes') playSound('yes');
           else if (payload.new.answer === 'No') playSound('no');
           else if (payload.new.answer.includes('Skipped')) playSound('skip');
        }
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
      setRoomCode(room.code);
      setRoomModifiers(room.modifiers || {});
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
        const { data: newRoom, error: createError } = await supabase.from('rooms').insert([{ code, status: 'waiting', wrong_guesses: 0, modifiers: {} }]).select().single();
        if (createError) throw new Error("Failed to create room: " + createError.message);
        room = newRoom;
      }

      const { data: existingPlayers } = await supabase.from('players').select('id').eq('room_id', room.id);
      const isFirstPlayer = existingPlayers.length === 0;

      if (isFirstPlayer && room.status !== 'waiting') {
        await supabase.from('rooms').update({ status: 'waiting', wrong_guesses: 0, modifiers: {} }).eq('id', room.id);
        await supabase.from('logs').delete().eq('room_id', room.id);
        room.status = 'waiting';
      }

      setCurrentRoomId(room.id);
      setGameState(room.status);

      const { data: newPlayer, error: playerError } = await supabase.from('players').insert([{
        room_id: room.id,
        name: playerName.trim(),
        avatar_url: playerAvatar,
        is_current_turn: false, 
        is_target: false, 
        has_been_target: false,      
        secret_character: 'unselected', 
        score: 0,
        questions_asked: 0,
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
    setShowEfficiencyPopup(false);
  };

  const handleModifierToggle = async (key, value) => {
    const newMods = { ...roomModifiers, [key]: value };
    setRoomModifiers(newMods);
    await supabase.from('rooms').update({ modifiers: newMods }).eq('id', currentRoomId);
  };

  const handleSetRolePref = async (role) => {
    await supabase.from('players').update({ secret_character: role }).eq('id', myPlayerId);
  };

  const handleStartMatch = async () => {
    const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });

    const hotseatWannabes = freshPlayers.filter(p => p.secret_character === 'hotseat');

    let chosenTarget;
    if (hotseatWannabes.length > 0) {
      const randomIndex = Math.floor(Math.random() * hotseatWannabes.length);
      chosenTarget = hotseatWannabes[randomIndex];
    } else {
      const randomIndex = Math.floor(Math.random() * freshPlayers.length);
      chosenTarget = freshPlayers[randomIndex];
    }

    await supabase.from('rooms').update({ status: 'draft' }).eq('id', currentRoomId);

    for (let p of freshPlayers) {
      const isTarget = p.id === chosenTarget.id;
      await supabase.from('players').update({
        is_target: isTarget,
        is_current_turn: isTarget,
        has_been_target: isTarget,
        secret_character: '', 
        score: 0,
        questions_asked: 0,
        has_guessed_correctly: false,
        is_eliminated: false,
        can_guess: true
      }).eq('id', p.id);
    }
  };

  const handleLockIn = async () => {
    const isHintMissing = !roomModifiers.noHints && !startingHint.trim();
    if (!secretCharacter.trim() || isHintMissing || players.length < 2 || isLockingIn) return;
    setIsLockingIn(true); 

    try {
      await supabase.from('players').update({ secret_character: secretCharacter, starting_hint: startingHint }).eq('id', myPlayerId);
      if (startingHint.trim() && !roomModifiers.noHints) {
        await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'hint', log_text: startingHint }]);
      }
      
      const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
      
      const firstInterrogator = freshPlayers.find(p => !p.is_target);
      if (firstInterrogator) {
        await supabase.from('players').update({ is_current_turn: false }).eq('room_id', currentRoomId); 
        await supabase.from('players').update({ is_current_turn: true }).eq('id', firstInterrogator.id); 
      }

      await supabase.from('rooms').update({ status: 'playing' }).eq('id', currentRoomId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLockingIn(false);
    }
  };

  const handleActionSubmit = async () => {
    if (!inputText.trim()) return;

    if (turnAction === 'question') {
      await supabase.from('players').update({ questions_asked: (myPlayer.questions_asked || 0) + 1 }).eq('id', myPlayerId);
      await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'question', log_text: inputText, player_name: myPlayer.name }]);
      setInputText('');
    } else {
      const isCorrect = fuzzyMatch(inputText, currentTarget.secret_character);
      
      if (isCorrect) {
        playSound('success');
        await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'guess', player_name: myPlayer.name, actual_guess: inputText, is_correct: true }]);
        
        await supabase.from('players').update({ 
          has_guessed_correctly: true, 
          score: (myPlayer.score || 0) + 10 
        }).eq('id', myPlayerId);
        
        setInputText('');
        processRoundEnd();
      } else {
        playSound('fail');
        await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'guess', player_name: myPlayer.name, actual_guess: inputText, is_correct: false }]);
        
        const { data: roomData } = await supabase.from('rooms').select('wrong_guesses').eq('id', currentRoomId).single();
        const currentWrongGuesses = roomData.wrong_guesses || 0;
        const newWrongCount = currentWrongGuesses + 1;
        
        await supabase.from('rooms').update({ wrong_guesses: newWrongCount }).eq('id', currentRoomId);
        
        let pointsForHotSeat = 0;
        if (newWrongCount === 1) pointsForHotSeat = 2;
        else if (newWrongCount === 2) pointsForHotSeat = 3;
        else if (newWrongCount >= 3) pointsForHotSeat = 5;

        if (roomModifiers.highStakes) pointsForHotSeat *= 2;

        const { data: targetData } = await supabase.from('players').select('score').eq('id', currentTarget.id).single();
        await supabase.from('players').update({ 
          score: (targetData.score || 0) + pointsForHotSeat 
        }).eq('id', currentTarget.id);

        if (roomModifiers.suddenDeath) {
          await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'system', log_text: `${myPlayer.name} guessed incorrectly and was eliminated by Sudden Death!` }]);
          await supabase.from('players').update({ is_eliminated: true }).eq('id', myPlayerId);
          setInputText('');
          setTurnAction('question');
          processRoundEnd(); 
        } else {
          setInputText('');
          setTurnAction('question');
          advanceTurn(); 
        }
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
    playSound('fail');
    await supabase.from('logs').insert([{ room_id: currentRoomId, log_type: 'tap_out', player_name: myPlayer.name, log_text: 'Tapped out' }]);
    await supabase.from('players').update({ is_eliminated: true }).eq('id', myPlayerId);
    processRoundEnd();
  };

  const processRoundEnd = async () => {
    const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
    
    const { data: roomCheck } = await supabase.from('rooms').select('status').eq('id', currentRoomId).single();
    if (roomCheck.status === 'scoreboard' || roomCheck.status === 'final_results') return;

    const activeInterrogators = freshPlayers.filter(p => !p.is_target && !p.is_eliminated);
    const allFinished = activeInterrogators.every(p => p.has_guessed_correctly);

    if (allFinished || activeInterrogators.length === 0) {
      const everyoneHosted = freshPlayers.every(p => p.has_been_target);
      
      if (everyoneHosted) {
        await handleEndGame(currentRoomId, freshPlayers); 
      } else {
        await supabase.from('rooms').update({ status: 'scoreboard' }).eq('id', currentRoomId);
      }
    } else {
      if (myPlayer.is_current_turn) advanceTurn(freshPlayers);
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
    
    const eligibleTargets = freshPlayers.filter(p => !p.has_been_target);
    const nextTarget = eligibleTargets.length > 0 
      ? eligibleTargets[Math.floor(Math.random() * eligibleTargets.length)]
      : freshPlayers[0]; 

    await supabase.from('rooms').update({ status: 'draft', wrong_guesses: 0 }).eq('id', currentRoomId);
    await supabase.from('logs').delete().eq('room_id', currentRoomId);

    for (let p of freshPlayers) {
      const isNext = p.id === nextTarget.id;
      await supabase.from('players').update({
        has_guessed_correctly: false,
        is_eliminated: false,
        can_guess: true,
        is_target: isNext,
        is_current_turn: isNext,
        has_been_target: p.has_been_target || isNext 
      }).eq('id', p.id);
    }
  };

  const handleEndGame = async (roomId, allPlayers) => {
    const validPlayers = allPlayers.filter(p => p.questions_asked > 0 || p.has_guessed_correctly);
    let minQ = 0;
    let winners = [];
    let message = "";

    if (validPlayers.length > 0) {
      minQ = Math.min(...validPlayers.map(p => p.questions_asked || 0));
      winners = validPlayers.filter(p => (p.questions_asked || 0) === minQ);
      
      for (const w of winners) {
         const { data: freshW } = await supabase.from('players').select('score').eq('id', w.id).single();
         await supabase.from('players').update({ score: (freshW.score || 0) + 10 }).eq('id', w.id);
      }
      
      const winnerNames = winners.map(w => w.name).join(' & ');
      message = `${winnerNames} guessed their target in the fewest questions (${minQ}) and earned a +10 Point Efficiency Bonus!`;
    } else {
      message = "No questions were asked this game. No efficiency bonus awarded.";
    }

    await supabase.from('rooms').update({ status: 'final_results' }).eq('id', roomId);
    await supabase.from('logs').insert([{ room_id: roomId, log_type: 'system', log_text: message }]);
  };

  const handleStartNewGame = async () => {
    const { data: freshPlayers } = await supabase.from('players').select('*').eq('room_id', currentRoomId).order('joined_at', { ascending: true });
    
    await supabase.from('rooms').update({ status: 'waiting', wrong_guesses: 0 }).eq('id', currentRoomId);
    await supabase.from('logs').delete().eq('room_id', currentRoomId);

    for (let p of freshPlayers) {
      await supabase.from('players').update({
        has_guessed_correctly: false,
        is_eliminated: false,
        can_guess: true,
        score: 0,
        questions_asked: 0,
        is_target: false,
        is_current_turn: false,
        has_been_target: false,
        secret_character: 'unselected' 
      }).eq('id', p.id);
    }
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col relative">

      <audio 
        ref={bgMusicRef} 
        src={LOFI_PLAYLIST[currentTrackIndex].url} 
        onEnded={playNextTrack}
      />

      <header className="w-full p-4 md:p-6 flex justify-between items-center z-40">
        <div className="flex items-center gap-2">
          <HelpCircle className="text-indigo-500" size={24} />
          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-400 tracking-wider">
            GUESS WHO: ARENA
          </span>
        </div>
        
        <div className="flex gap-2 items-center">
          
          <div className="relative" ref={audioMenuRef}>
            <motion.button 
              layout
              onClick={() => { setShowAudioMenu(!showAudioMenu); }} 
              className={`h-[42px] px-3 flex items-center justify-center gap-2 rounded-lg transition-colors border ${showAudioMenu ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-transparent text-gray-400 hover:text-white border-transparent'}`}
              title="Audio Settings"
            >
              <AnimatePresence mode="wait">
                {bannerState === 'idle' && (
                  <motion.div key="idle" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="flex items-center justify-center">
                    {musicVolume === 0 && sfxVolume === 0 ? <VolumeX size={20} /> : <SlidersHorizontal size={20} />}
                  </motion.div>
                )}
                {bannerState === 'now-playing' && (
                  <motion.div key="playing" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 whitespace-nowrap">Now Playing</span>
                  </motion.div>
                )}
                {bannerState === 'song-name' && (
                  <motion.div key="song" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="flex items-center gap-2">
                    <Music size={14} className="text-rose-400" />
                    <span className="text-xs font-bold truncate max-w-[140px] text-white whitespace-nowrap">
                      {LOFI_PLAYLIST[currentTrackIndex].title}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <AnimatePresence>
              {showAudioMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-12 w-72 bg-neutral-900 border border-neutral-700 p-5 rounded-2xl shadow-2xl z-50 flex flex-col gap-6"
                >
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 shadow-inner flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-rose-400 mb-1 w-full justify-center">
                      <Music size={16} /> 
                      <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Currently Playing</span>
                    </div>
                    
                    <a 
                      href={LOFI_PLAYLIST[currentTrackIndex].link} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-sm font-bold text-white hover:text-indigo-400 transition-colors text-center w-full truncate px-2"
                      title="Listen on Pixabay"
                    >
                      {LOFI_PLAYLIST[currentTrackIndex].title}
                    </a>
                    
                    <div className="flex items-center gap-6 mt-2">
                      <button onClick={playPreviousTrack} className="text-gray-400 hover:text-white transition-transform hover:scale-110 active:scale-95"><SkipBack size={20}/></button>
                      <button onClick={togglePlayPause} className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                        {isMusicPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-1"/>}
                      </button>
                      <button onClick={playNextTrack} className="text-gray-400 hover:text-white transition-transform hover:scale-110 active:scale-95"><SkipForward size={20}/></button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center justify-between mb-2">
                      <span>Music Volume</span>
                      <span className="text-indigo-400">{Math.round(musicVolume * 200)}%</span>
                    </label>
                    <input 
                      type="range" min="0" max="0.5" step="0.01" 
                      value={musicVolume} 
                      onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))} 
                      className="w-full accent-indigo-500 cursor-pointer" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-widest flex justify-between mb-2">
                      <span>SFX Volume</span>
                      <span className="text-rose-400">{Math.round(sfxVolume * 100)}%</span>
                    </label>
                    <input 
                      type="range" min="0" max="1" step="0.01" 
                      value={sfxVolume} 
                      onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))} 
                      className="w-full accent-rose-500 cursor-pointer" 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Blurred Lobby Code Button */}
          {currentRoomId && roomCode && (
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 transition-all mr-2">
               <span className="text-xs text-gray-500 uppercase font-bold hidden md:inline">Code:</span>
               <span className={`font-mono font-bold tracking-widest text-indigo-400 transition-all duration-300 ${!showRoomCode ? 'blur-[4px] select-none' : ''}`}>
                  {roomCode}
               </span>
               <button onClick={() => setShowRoomCode(!showRoomCode)} className="text-gray-400 hover:text-white transition-colors ml-1" title={showRoomCode ? "Hide Code" : "Show Code"}>
                  {showRoomCode ? <EyeOff size={16} /> : <Eye size={16} />}
               </button>
            </div>
          )}
          
          {currentRoomId && (
            <>
              <button onClick={() => setShowRules(true)} className="bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-400 text-sm font-bold px-4 py-2 rounded-lg transition-colors border border-indigo-800/50 flex items-center gap-2 h-[42px]">
                <Info size={16} /> <span className="hidden sm:inline">Rules</span>
              </button>
              <button onClick={handleLeaveRoom} className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-sm font-bold px-4 py-2 rounded-lg transition-colors border border-rose-800/50 flex items-center gap-2 h-[42px]">
                <LogOut size={16} /> <span className="hidden sm:inline">Leave</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Rules Modal Overlay */}
      <AnimatePresence>
        {showRules && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={24}/></button>
                <h2 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-400">Point System</h2>
                <ul className="space-y-4 text-gray-300">
                  <li className="flex gap-3 items-start"><Check className="text-emerald-500 mt-1 shrink-0"/> <span><strong>Correct Guess:</strong> The guesser earns exactly <strong>10 points</strong>.</span></li>
                  <li className="flex gap-3 items-start"><X className="text-rose-500 mt-1 shrink-0"/> <span><strong>Wrong Guesses:</strong> Award the player in the Hot Seat:
                    <ul className="pl-2 pt-2 space-y-1 list-disc list-inside text-gray-400 text-sm">
                      <li>1st wrong guess = 2 pts</li>
                      <li>2nd wrong guess = 3 pts</li>
                      <li>3rd+ wrong guess = 5 pts</li>
                    </ul>
                  </span></li>
                  <li className="flex gap-3 items-start"><Trophy className="text-amber-500 mt-1 shrink-0"/> <span><strong>Efficiency Bonus:</strong> At the end of the game, the player who guessed their target in the fewest total questions gets a <strong>10 point bonus!</strong></span></li>
                </ul>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowRules(false)} className="mt-8 w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 rounded-xl transition-colors">Got it</motion.button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWinnerPopup && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-none">
            <div className="bg-emerald-950/40 border-2 border-emerald-500/50 p-10 rounded-3xl text-center shadow-[0_0_80px_rgba(16,185,129,0.2)]">
              <h1 className="text-4xl md:text-6xl font-bold text-emerald-400 mb-4 tracking-tight">Target Acquired</h1>
              <p className="text-xl md:text-3xl text-emerald-100 font-medium"><span className="text-white font-bold">{showWinnerPopup}</span> figured it out! (+10 pts)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEfficiencyPopup && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="absolute top-20 left-0 right-0 mx-auto z-50 flex items-center justify-center pointer-events-none px-4">
            <div className="bg-amber-950/90 border-2 border-amber-500 p-6 rounded-2xl text-center shadow-[0_0_60px_rgba(245,158,11,0.3)] backdrop-blur-md max-w-2xl w-full">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Trophy className="text-amber-400" size={32} />
                <h2 className="text-2xl md:text-3xl font-bold text-amber-400 uppercase tracking-widest">Efficiency Bonus</h2>
                <Trophy className="text-amber-400" size={32} />
              </div>
              <p className="text-lg md:text-xl text-amber-100 font-medium">{efficiencyMessage}</p>
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

              {/* Profile Picture Uploader */}
              <div className="flex flex-col items-center mt-2 space-y-2">
                 <div className="relative w-24 h-24 rounded-full border-2 border-dashed border-neutral-700 bg-neutral-950 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors group">
                    {playerAvatar ? (
                       <img src={playerAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                       <User size={32} className="text-gray-500 group-hover:text-indigo-400 transition-colors" />
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="text-[10px] font-bold uppercase tracking-widest">Upload</span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" title="Upload Profile Picture (Optional)" />
                 </div>
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">(Optional)</span>
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
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleCreateOrJoinRoom} disabled={!roomCode || !playerName} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2">
                <Users size={20} /> Enter Arena
              </motion.button>
            </motion.div>
          )}

          {gameState === 'waiting' && (
             <motion.div key="waiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2rem] p-8 shadow-2xl flex flex-col space-y-6 relative z-10">
                <div className="text-center space-y-2 border-b border-neutral-800 pb-6">
                   <Users size={40} className="mx-auto text-indigo-500 mb-4" />
                   <h2 className="text-3xl font-bold">Waiting Room</h2>
                   <p className="text-gray-400">Select your preferred role for Round 1.</p>
                </div>

                <div className="space-y-4">
                   <div className="flex gap-4">
                      <button onClick={() => handleSetRolePref('hotseat')} className={`flex-1 py-4 rounded-xl font-bold border-2 transition-all flex flex-col items-center gap-2 ${myPlayer.secret_character === 'hotseat' ? 'bg-rose-600/20 border-rose-500 text-rose-400' : 'bg-neutral-950 border-neutral-800 text-gray-500 hover:border-gray-600'}`}>
                        <span className="text-3xl">🔥</span>
                        Hot Seat
                      </button>
                      <button onClick={() => handleSetRolePref('guesser')} className={`flex-1 py-4 rounded-xl font-bold border-2 transition-all flex flex-col items-center gap-2 ${myPlayer.secret_character === 'guesser' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-neutral-950 border-neutral-800 text-gray-500 hover:border-gray-600'}`}>
                        <span className="text-3xl">🕵️</span>
                        Guesser
                      </button>
                   </div>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide pt-2">
                   <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Players Joined ({players.length})</h3>
                   {players.map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-neutral-950/50 p-3 rounded-xl border border-neutral-800">
                         <div className="flex items-center gap-3">
                            {p.avatar_url ? (
                               <img src={p.avatar_url} className="w-8 h-8 rounded-full object-cover border border-neutral-700 flex-shrink-0" alt="avatar" />
                            ) : (
                               <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 flex-shrink-0"><User size={14} className="text-gray-500" /></div>
                            )}
                            <span className="font-bold text-gray-300">{p.name}</span>
                            {players.length > 0 && players[0].id === p.id && <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">👑 Host</span>}
                         </div>
                         <div>
                            {p.secret_character === 'hotseat' && <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Hot Seat 🔥</span>}
                            {p.secret_character === 'guesser' && <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Guesser 🕵️</span>}
                            {(p.secret_character !== 'hotseat' && p.secret_character !== 'guesser') && <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Selecting...</span>}
                         </div>
                      </div>
                   ))}
                </div>

                {isHost && (
                   <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleStartMatch} disabled={players.length < 2} className="w-full font-bold py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2">
                     <Play fill="currentColor" size={18} /> {players.length < 2 ? "Waiting for players..." : "Start Match"}
                   </motion.button>
                )}
                {!isHost && (
                   <div className="text-center text-gray-500 font-bold uppercase tracking-widest mt-6">
                     Waiting for Host to start...
                   </div>
                )}
             </motion.div>
          )}

          {gameState === 'draft' && (
            <motion.div key="draft" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2rem] p-8 shadow-2xl flex flex-col space-y-6 relative z-10">
              <div className="text-center space-y-2 border-b border-neutral-800 pb-6">
                <ShieldAlert size={40} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-3xl font-bold flex items-center justify-center gap-2">
                  {players.length > 0 && currentTarget.id === players[0].id && <span className="text-amber-500 text-2xl relative -translate-y-[2px]" title="Host">👑</span>}
                  <span>{myPlayer.id === currentTarget.id ? "You are in the Hot Seat." : `${currentTarget.name} is in the Hot Seat.`}</span>
                </h2>
                <p className="text-gray-400 mt-2">Waiting for target to lock in character...</p>
              </div>
              
              {myPlayer.id === currentTarget.id ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block uppercase tracking-wider font-bold">Character Name</label>
                    <input type="text" value={secretCharacter} onChange={(e) => setSecretCharacter(e.target.value)} placeholder="e.g., Gordon Ramsay" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 focus:border-rose-500 focus:outline-none text-lg" />
                  </div>
                  
                  {!roomModifiers.noHints && (
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block uppercase tracking-wider font-bold">Starting Hint (Required)</label>
                      <input type="text" value={startingHint} onChange={(e) => setStartingHint(e.target.value)} placeholder="e.g., Known for being angry." className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 focus:border-rose-500 focus:outline-none" />
                    </div>
                  )}

                  {roomModifiers.noHints && (
                    <div className="bg-rose-950/30 border border-rose-900/50 p-4 rounded-xl flex items-start gap-3">
                       <EyeOff className="text-rose-500 shrink-0" size={20} />
                       <div>
                          <span className="text-rose-400 font-bold block text-sm">Blind Interrogation Active</span>
                          <span className="text-xs text-gray-400">You are not allowed to provide a starting hint this round.</span>
                       </div>
                    </div>
                  )}

                  <motion.button 
                    whileHover={!isLockingIn ? { scale: 1.05 } : {}} 
                    whileTap={!isLockingIn ? { scale: 0.95 } : {}} 
                    onClick={handleLockIn} 
                    disabled={!secretCharacter.trim() || (!roomModifiers.noHints && !startingHint.trim()) || players.length < 2 || isLockingIn} 
                    className="w-full font-bold py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {players.length < 2 ? "Waiting for players to join..." : isLockingIn ? "Locking In..." : "Lock In Target"}
                  </motion.button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-gray-500">
                   <Loader2 className="animate-spin" size={32} />
                   <p className="text-xl uppercase tracking-widest font-bold">Waiting for {currentTarget.name}...</p>
                </div>
              )}

              {isHost && (
                <div className="mt-8 border-t border-neutral-800 pt-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Host Settings: Modifiers</h3>
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={roomModifiers.suddenDeath || false} onChange={(e) => handleModifierToggle('suddenDeath', e.target.checked)} className="w-5 h-5 accent-rose-500 rounded bg-neutral-800 border-neutral-700" />
                      <div>
                         <span className="text-white font-bold flex items-center gap-2 group-hover:text-rose-400 transition-colors"><Skull size={16} /> Sudden Death</span>
                         <span className="text-xs text-gray-500">1 wrong guess = instant elimination.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={roomModifiers.noHints || false} onChange={(e) => handleModifierToggle('noHints', e.target.checked)} className="w-5 h-5 accent-amber-500 rounded bg-neutral-800 border-neutral-700" />
                      <div>
                         <span className="text-white font-bold flex items-center gap-2 group-hover:text-amber-400 transition-colors"><EyeOff size={16} /> Blind Interrogation</span>
                         <span className="text-xs text-gray-500">Target cannot give a starting hint.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={roomModifiers.highStakes || false} onChange={(e) => handleModifierToggle('highStakes', e.target.checked)} className="w-5 h-5 accent-purple-500 rounded bg-neutral-800 border-neutral-700" />
                      <div>
                         <span className="text-white font-bold flex items-center gap-2 group-hover:text-purple-400 transition-colors"><Flame size={16} /> High Stakes</span>
                         <span className="text-xs text-gray-500">Wrong guesses give the Target double points.</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md md:max-w-none md:w-[95vw] lg:w-[90vw] 2xl:max-w-[1500px] bg-neutral-900 border border-neutral-800 rounded-3xl md:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[82vh] relative z-10">
              <div className="md:p-6 lg:p-8 border-b md:border-b-0 md:border-r border-neutral-800 bg-neutral-900/80 backdrop-blur-sm flex md:flex-col justify-between items-start md:w-80 lg:w-96 flex-shrink-0 z-10 h-auto md:h-full">
                <div className="w-full flex flex-col overflow-hidden">
                  <div className="w-full flex border-b border-neutral-800 mb-4 bg-neutral-950/50 rounded-t-xl overflow-hidden px-4 py-3 items-center justify-center gap-2 text-indigo-400 font-bold uppercase tracking-widest text-xs flex-shrink-0">
                    <Lightbulb size={14} /> Intel Log
                  </div>
                  
                  <div className="flex flex-col space-y-3 w-full h-32 md:h-[50vh] overflow-y-auto px-4 md:px-0 pr-2 pb-4 scrollbar-hide">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Live Activity</span>
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
                            ) : (myPlayer.id === currentTarget.id || myPlayer.name === log.player) ? (
                              <span className="text-rose-400 font-bold">❌ {log.player} guessed: "{log.actualGuess}"</span>
                            ) : (
                              <span className="text-gray-500 italic">❌ {log.player} guessed incorrectly.</span>
                            )}
                          </div>
                        )}
                        {log.type === 'system' && (
                          <div><span className="text-amber-500 font-bold">⚠️ {log.text}</span></div>
                        )}
                        {log.type === 'tap_out' && (
                          <div><span className="text-gray-500 italic">🏳️ {log.player} gave up and tapped out.</span></div>
                        )}
                      </div>
                    ))}
                    {/* Auto-scroll anchor */}
                    <div ref={logEndRef} />
                  </div>
                </div>

                {!myPlayer.has_guessed_correctly && !myPlayer.is_target && !myPlayer.is_eliminated && (
                  <div className="w-full pt-4 mt-auto border-t border-neutral-800 flex-shrink-0">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleTapOut} className="w-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                      <Flag size={14} /> Tap Out (Give Up)
                    </motion.button>
                  </div>
                )}
              </div>

              <div className="flex-grow flex flex-col relative h-full bg-neutral-950/50 overflow-hidden">
                <div className="w-full bg-neutral-900/50 border-b border-neutral-800 overflow-x-auto">
                  <div className="flex items-center justify-center gap-6 min-w-max px-4 pt-12 pb-4">
                    {players.map((player) => (
                      <div key={player.id} className={`flex flex-col items-center relative ${player.has_guessed_correctly || player.is_eliminated ? 'opacity-50' : 'opacity-100'}`}>
                        
                        <div className="relative flex justify-center">
                          <ScoreFloater score={player.score} />
                          <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 relative overflow-hidden ${player.is_eliminated ? 'border-rose-500 bg-rose-500/10' : player.has_guessed_correctly ? 'border-emerald-500 bg-emerald-500/10' : player.is_current_turn ? 'border-indigo-500 bg-indigo-500/10' : player.is_target ? 'border-rose-500 bg-rose-500/10' : 'border-neutral-700 bg-neutral-800'}`}>
                            {player.is_eliminated ? (
                               <>
                                  {player.avatar_url && <img src={player.avatar_url} className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale" alt={player.name} />}
                                  <X size={28} className="text-rose-500 relative z-10" />
                               </>
                            ) : player.has_guessed_correctly ? (
                               <>
                                  {player.avatar_url && <img src={player.avatar_url} className="absolute inset-0 w-full h-full object-cover opacity-30" alt={player.name} />}
                                  <Check size={28} className="text-emerald-500 relative z-10" />
                               </>
                            ) : player.avatar_url ? (
                               <img src={player.avatar_url} className="w-full h-full object-cover" alt={player.name} />
                            ) : (
                               <User size={24} />
                            )}
                          </div>
                        </div>

                        <div className="bg-neutral-900 text-xs font-bold px-2 py-0.5 rounded-md border border-neutral-700 whitespace-nowrap z-10 mt-2">
                          {player.score} pts
                        </div>
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-400 mt-1 flex items-center justify-center gap-1">
                          {players.length > 0 && player.id === players[0].id && (
                             <span className="text-amber-500 relative -translate-y-[2px]" title="Host">👑</span>
                          )}
                          <span>{player.name}</span>
                        </span>
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
                        <h2 className="text-2xl md:text-5xl font-bold flex items-center justify-center gap-2">
                          {myPlayer.id === currentTarget.id ? (
                            <span>You are in the <span className="text-rose-500">Hot Seat</span></span>
                          ) : (
                            <span>Target: <span className="text-rose-500">{currentTarget.name}</span></span>
                          )}
                        </h2>

                        <div className="flex gap-2 justify-center mt-1 flex-wrap">
                          {roomModifiers.suddenDeath && <span className="bg-rose-900/40 border border-rose-500/30 text-rose-400 text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold flex items-center gap-1"><Skull size={10} /> Sudden Death</span>}
                          {roomModifiers.noHints && <span className="bg-amber-900/40 border border-amber-500/30 text-amber-400 text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold flex items-center gap-1"><EyeOff size={10} /> Blind</span>}
                          {roomModifiers.highStakes && <span className="bg-purple-900/40 border border-purple-500/30 text-purple-400 text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold flex items-center gap-1"><Flame size={10} /> High Stakes</span>}
                        </div>
                        
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
                            <button onClick={() => { setTurnAction('question'); }} className={`flex-1 py-3 text-sm font-bold rounded-xl ${turnAction === 'question' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Ask Question</button>
                            <button 
                              onClick={() => { setTurnAction('guess'); }} 
                              className={`flex-1 py-3 text-sm font-bold rounded-xl ${turnAction === 'guess' ? 'bg-rose-600 text-white' : 'text-gray-500'}`}
                            >
                              Assassinate (Guess)
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
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleActionSubmit} className="bg-white text-black font-bold px-6 py-4 rounded-2xl"><Send size={24} /></motion.button>
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
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleAnswerSubmit('Yes')} className="flex-1 bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400 font-bold py-6 rounded-2xl text-2xl uppercase flex items-center justify-center gap-2"><Check size={28} /> Yes</motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSkip} className="flex-[1.5] bg-neutral-800 border-2 border-neutral-600 text-gray-300 font-bold py-6 rounded-2xl text-xl uppercase flex items-center justify-center gap-2"><SkipForward size={24} /> Skip</motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleAnswerSubmit('No')} className="flex-1 bg-rose-600/20 border-2 border-rose-500 text-rose-400 font-bold py-6 rounded-2xl text-2xl uppercase flex items-center justify-center gap-2"><X size={28} /> No</motion.button>
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
                <Crosshair size={48} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-4xl font-bold">Round Over!</h2>
                <p className="text-gray-400">The secret character was: <span className="text-rose-400 font-bold">{currentTarget.secret_character}</span></p>
              </div>
              <div className="space-y-3">
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className="flex justify-between items-center p-4 rounded-xl bg-neutral-800/50 border border-neutral-700">
                    <div className="flex flex-col">
                      <span className="font-bold text-lg flex items-center gap-2">
                        {players.length > 0 && p.id === players[0].id && <span className="text-amber-500 text-sm relative -translate-y-[2px]" title="Host">👑</span>}
                        {p.avatar_url ? (
                           <img src={p.avatar_url} className="w-6 h-6 rounded-full object-cover border border-neutral-700 ml-1" alt="avatar" />
                        ) : (
                           <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 ml-1"><User size={10} className="text-gray-500" /></div>
                        )}
                        {p.name}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">Questions Asked: {p.questions_asked || 0}</span>
                    </div>
                    <span className="font-bold text-2xl">{p.score} pts</span>
                  </div>
                ))}
              </div>
              
              {isHost && (
                <div className="flex gap-4 w-full pt-4">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleNextRound} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2">
                    Start Next Round <ArrowRight size={20} />
                  </motion.button>
                </div>
              )}
              {!isHost && (
                <div className="text-center text-gray-500 font-bold uppercase tracking-widest mt-4">
                  Waiting for Host...
                </div>
              )}
            </motion.div>
          )}

          {gameState === 'final_results' && (
            <motion.div key="final_results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2rem] p-8 shadow-2xl flex flex-col space-y-8 relative z-10">
              <div className="text-center space-y-2 border-b border-neutral-800 pb-6">
                <Trophy size={64} className="mx-auto text-amber-500 mb-4" />
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">FINAL STANDINGS</h2>
                <p className="text-gray-400">The final secret character was: <span className="text-rose-400 font-bold">{currentTarget.secret_character}</span></p>
              </div>
              <div className="space-y-3">
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className={`flex justify-between items-center p-4 rounded-xl border ${i === 0 ? 'bg-amber-950/30 border-amber-500/50' : 'bg-neutral-800/50 border-neutral-700'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xl font-black ${i === 0 ? 'text-amber-500' : 'text-gray-500'}`}>#{i + 1}</span>
                      <div className="flex flex-col">
                         <span className="font-bold text-lg flex items-center gap-2">
                           {players.length > 0 && p.id === players[0].id && <span className="text-amber-500 text-sm relative -translate-y-[2px]" title="Host">👑</span>}
                           {p.avatar_url ? (
                               <img src={p.avatar_url} className="w-6 h-6 rounded-full object-cover border border-neutral-700 ml-1" alt="avatar" />
                            ) : (
                               <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 ml-1"><User size={10} className="text-gray-500" /></div>
                            )}
                           {p.name}
                         </span>
                         <span className="text-xs text-gray-500 font-medium">Total Questions: {p.questions_asked || 0}</span>
                      </div>
                    </div>
                    <span className={`font-bold text-2xl ${i === 0 ? 'text-amber-500' : 'text-white'}`}>{p.score} pts</span>
                  </div>
                ))}
              </div>
              {isHost && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleStartNewGame} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-xl transition-all flex justify-center items-center gap-3 text-lg">
                  Start New Game <ArrowRight size={20} />
                </motion.button>
              )}
              {!isHost && (
                <div className="text-center text-gray-500 font-bold uppercase tracking-widest mt-4">
                  Waiting for Host...
                </div>
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