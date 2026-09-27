/// <reference types="vite/client" />

// Pulls in Vite's ambient module declarations — chiefly the `*.css` side-effect imports in
// main.tsx, which were never declared here: TypeScript 5 let them through, TypeScript 7 does not
// (TS2882). Also what makes `import.meta.env` typed, should anything start using it.
