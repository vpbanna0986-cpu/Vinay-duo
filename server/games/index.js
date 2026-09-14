const registry = require('./registry');

// ═══════════════════════════════════════════════════════
//  VINAY DUO — 29 Games Registry
//  Made by VP
// ═══════════════════════════════════════════════════════

// ── Speed / Reaction ──
registry.register('reaction_battle', require('./reaction_battle'));
registry.register('ten_second', require('./ten_second'));
registry.register('flash_grid', require('./flash_grid'));

// ── Memory / Brain ──
registry.register('memory_match', require('./memory_match'));
registry.register('sequence_memory', require('./sequence_memory'));
registry.register('number_recall', require('./number_recall'));
registry.register('quick_math', require('./quick_math'));
registry.register('odd_one_out', require('./odd_one_out'));
registry.register('pattern_complete', require('./pattern_complete'));
registry.register('emoji_memory', require('./emoji_memory'));

// ── Word / Creative ──
registry.register('word_scramble', require('./word_scramble'));
registry.register('emoji_guess', require('./emoji_guess'));
registry.register('guess_word', require('./guess_word'));
registry.register('describe_guess', require('./describe_guess'));
registry.register('guess_sound', require('./guess_sound'));
registry.register('draw_guess', require('./draw_guess'));

// ── Head-to-Head ──
registry.register('who_knows_who', require('./who_knows_who'));
registry.register('rps', require('./rps'));
registry.register('tictactoe', require('./tictactoe'));
registry.register('connect_four', require('./connect_four'));
registry.register('number_battle', require('./number_battle'));
registry.register('higher_lower', require('./higher_lower'));
registry.register('quiz_battle', require('./quiz_battle'));

// ── Social / Random ──
registry.register('random_challenge', require('./random_challenge'));
registry.register('friendship_quiz', require('./friendship_quiz'));
registry.register('who_more_likely', require('./who_more_likely'));
registry.register('this_or_that', require('./this_or_that'));
registry.register('would_you_rather', require('./would_you_rather'));
registry.register('truth_questions', require('./truth_questions'));

module.exports = registry;
