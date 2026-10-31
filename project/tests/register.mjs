// Lets `node --test` resolve the project's "@/..." imports to TypeScript files.
import { register } from 'node:module';

register('./resolve-hook.mjs', import.meta.url);
