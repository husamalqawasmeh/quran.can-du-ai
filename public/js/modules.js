// The page's ES-module imports, handed to the classic scripts in public/js/ as globals.
import { voiceprints, SR } from '/voiceprint.js';
import { embed } from '/embed.js';
Object.assign(window, { voiceprints, SR, embed });
