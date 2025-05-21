declare global {
    namespace NodeJS {
        export interface ProcessEnv {
            readonly MOLLIE_API_KEY: string;
        }
    }
}
export {};
