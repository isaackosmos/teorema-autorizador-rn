/**
 * Converte o corpo binário de uma resposta HTTP em `data:` URI, que é o que o
 * `<Image>` do React Native consome sem precisar de arquivo em disco.
 *
 * O tipo é imposto por parâmetro, não lido do `Content-Type`: o Orion devolve
 * a logo com `Res.SendFile` de um arquivo temporário, e o cabeçalho depende de
 * como o Horse adivinhou a extensão. Quem chama sabe o formato esperado.
 */
export function blobToDataUri(blob: Blob, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const lido = typeof reader.result === 'string' ? reader.result : '';
      const base64 = lido.slice(lido.indexOf(',') + 1);

      if (base64 === '') {
        reject(new Error('Imagem vazia.'));
        return;
      }

      resolve(`data:${mimeType};base64,${base64}`);
    };

    reader.readAsDataURL(blob);
  });
}
