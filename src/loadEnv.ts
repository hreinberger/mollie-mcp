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
    // If the .env file is not found, log it but don't throw an error.
    // The application can still run if environment variables are set directly.
    console.warn(
        `[loadEnv.ts] Warning: Could not load .env file from ${envPath}. Falling back to environment variables. Error: ${dotenvResult.error.message}`
    );
    // throw dotenvResult.error; // Do not throw error, allow fallback to environment variables
} else {
    // Optional: Log if the .env file was parsed but is empty, for awareness.
    if (dotenvResult.parsed && Object.keys(dotenvResult.parsed).length === 0) {
        console.warn(
            `[loadEnv.ts] .env file loaded from ${envPath} but is empty or contains no variables.`
        );
    } else if (dotenvResult.parsed) {
        console.log(
            `[loadEnv.ts] .env file loaded successfully from ${envPath}.`
        );
    }
}
