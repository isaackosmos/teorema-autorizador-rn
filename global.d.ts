// Permite `import './styles/global.css'` no layout raiz.
// Os tipos de `className` vêm de nativewind-env.d.ts, gerado pelo Metro.
declare module '*.css' {
  const content: string;
  export default content;
}
