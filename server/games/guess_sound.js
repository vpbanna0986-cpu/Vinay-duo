// No copyrighted audio — frontend generates simple tones using Web Audio API
// Server sends: soundKey (for synthesis) + hint + accepted answers

const SOUNDS = [
  { key: 'beep', hint: 'Electronic beep', answers: ['beep', 'beeping', 'electronic'] },
  { key: 'bell', hint: 'Ring ring, ding dong', answers: ['bell', 'ring', 'ding dong', 'doorbell'] },
  { key: 'siren', hint: 'Wee-woo wee-woo', answers: ['siren', 'ambulance', 'police', 'emergency'] },
  { key: 'tick', hint: 'Constant small clicks', answers: ['clock', 'tick tock', 'ticking'] },
  { key: 'buzz', hint: 'Angry insect sound', answers: ['bee', 'buzz', 'mosquito', 'fly'] },
  { key: 'horn', hint: 'Honk honk', answers: ['car horn', 'horn', 'honk', 'truck'] },
  { key: 'whistle', hint: 'Referee sound', answers: ['whistle', 'referee'] },
  { key: 'drum', hint: 'Boom boom boom', answers: ['drum', 'drumming'] },
  { key: 'birds', hint: 'Tweet tweet', answers: ['bird', 'birds', 'chirp', 'sparrow'] },
  { key: 'rain', hint: 'Soft pitter patter', answers: ['rain', 'raining', 'rainfall'] },
  { key: 'thunder', hint: 'Boom in the sky', answers: ['thunder', 'storm', 'lightning'] },
  { key: 'wind', hint: 'Whoosh', answers: ['wind', 'breeze', 'blowing'] },
  { key: 'water', hint: 'Drip drop', answers: ['water', 'dripping', 'faucet', 'tap'] },
  { key: 'typing', hint: 'Click click click', answers: ['keyboard', 'typing', 'typewriter'] },
  { key: 'door', hint: 'Creak', answers: ['door', 'creaking door', 'gate'] },
  { key: 'footsteps', hint: 'Tap tap tap on floor', answers: ['footsteps', 'steps', 'walking'] },
  { key: 'heartbeat', hint: 'Thump thump', answers: ['heartbeat', 'heart', 'pulse'] },
  { key: 'camera', hint: 'Click flash', answers: ['camera', 'photo', 'picture'] },
  { key: 'marble', hint: 'Small rolling sound', answers: ['marble', 'rolling ball'] },
  { key: 'coin', hint: 'Clink clink', answers: ['coin', 'money', 'change'] },
  { key: 'whoosh', hint: 'Fast passing air', answers: ['whoosh', 'wind', 'passing'] },
  { key: 'ping', hint: 'Notification', answers: ['notification', 'ping', 'message'] },
  { key: 'pop', hint: 'Bubble', answers: ['pop', 'bubble', 'balloon'] },
  { key: 'click', hint: 'Single small click', answers: ['click', 'mouse', 'button'] },
  { key: 'drip', hint: 'Single drop', answers: ['drip', 'drop', 'leak'] },
  { key: 'laugh', hint: 'Ha ha ha', answers: ['laugh', 'laughing', 'giggle'] },
  { key: 'snore', hint: 'Sleeping noise', answers: ['snore', 'snoring', 'sleep'] },
  { key: 'clap', hint: 'Hands coming together', answers: ['clap', 'clapping', 'applause'] },
  { key: 'sneeze', hint: 'Achoo', answers: ['sneeze', 'sneezing', 'achoo'] },
  { key: 'yawn', hint: 'Tired sound', answers: ['yawn', 'yawning'] },
  { key: 'snap', hint: 'Finger snap', answers: ['snap', 'finger snap'] },
  { key: 'stomp', hint: 'Heavy footstep', answers: ['stomp', 'stomping'] },
  { key: 'rattle', hint: 'Shake shake', answers: ['rattle', 'shaking', 'baby toy'] },
  { key: 'balloon', hint: 'Stretch squeak', answers: ['balloon', 'rubber'] },
  { key: 'spray', hint: 'Psssst', answers: ['spray', 'aerosol', 'deodorant'] }
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = {
  totalRounds: 5,
  roundState: {},
  usedSounds: [],

  onStart(engine) {
    this.roundState = {};
    this.usedSounds = [];
    this.startRound(engine);
  },

  pickSound() {
    const available = SOUNDS.filter(s => !this.usedSounds.includes(s.key));
    if (available.length === 0) {
      this.usedSounds = [];
      return this.pickSound();
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedSounds.push(picked.key);
    return picked;
  },

  startRound(engine) {
    const r = engine.round;
    const sound = this.pickSound();

    this.roundState[r] = {
      sound,
      answered: {},
      resolved: false,
      roundStart: Date.now()
    };

    engine.emitToPlayers('game:sound:play', {
      round: r,
      totalRounds: 5,
      soundKey: sound.key,
      hint: sound.hint
    });

    // 20s to answer
    engine.setTimer(20000, () => {
      if (!this.roundState[r].resolved) {
        this.roundState[r].resolved = true;
        engine.emitToPlayers('game:sound:timeout', {
          round: r, answer: sound.answers[0]
        });
        engine.setTimer(1500, () => engine.roundComplete());
      }
    });
  },

  handleAction(engine, { userId, action, payload }) {
    if (action !== 'answer') return { ok: false, error: 'BAD_ACTION' };
    const r = engine.round;
    const st = this.roundState[r];
    if (!st || st.resolved) return { ok: false, error: 'ROUND_OVER' };
    if (st.answered[userId]) return { ok: false, error: 'ALREADY_ANSWERED' };

    const guess = String(payload?.answer || '').toLowerCase().trim();
    st.answered[userId] = guess;

    const isCorrect = st.sound.answers.some(a =>
      guess === a || guess.includes(a) || a.includes(guess)
    );

    if (isCorrect && guess.length >= 3) {
      const elapsed = Date.now() - st.roundStart;
      const speedBonus = Math.max(1, Math.floor((20000 - elapsed) / 2000));
      const score = 20 + speedBonus;
      engine.awardPoints(userId, score);

      engine.emitToPlayers('game:sound:correct', {
        round: r, userId, guess, score
      });

      st.resolved = true;
      engine.emitToPlayers('game:sound:round-end', {
        round: r, answer: st.sound.answers[0]
      });
      engine.setTimer(1500, () => engine.roundComplete());
    } else {
      engine.emitToPlayers('game:sound:wrong', {
        round: r, userId, guess
      });
    }

    return { ok: true };
  },

  onFinish(engine) {
    return { details: { scores: engine.scores } };
  }
};
