import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the directory of the current module (will be build/loadEnv.js at runtime)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the path to the .env file in the project root (one level up from build/)
const envPath = path.resolve(__dirname, '../.env');

const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
    // If the .env file is critical for the application, re-throwing the error
    // ensures the application doesn't run with missing configuration.
    console.error(
        `Failed to load .env file from ${envPath}:`,
        dotenvResult.error
    );
    throw dotenvResult.error;
}

// Optional: Log if the .env file was parsed but is empty, for awareness.
// if (dotenvResult.parsed && Object.keys(dotenvResult.parsed).length === 0) {
//     console.warn(`[loadEnv.ts] .env file loaded from ${envPath} but is empty or contains no variables.`);
// }
