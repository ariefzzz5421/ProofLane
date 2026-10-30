import { globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
const config = [...nextVitals, ...nextTs, globalIgnores(['.next/**', 'drizzle/**'])];
export default config;
