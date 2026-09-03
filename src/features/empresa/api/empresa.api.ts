import { tenantApi } from '@/shared/lib/http/client';
import { blobToDataUri } from '@/shared/lib/image/data-uri';

/**
 * Logo da empresa corrente, exibida no cabeçalho do app.
 *
 * O endpoint devolve **o arquivo de imagem**, não JSON: é o conteúdo da coluna
 * `EMPRESAS.EMPRESA_LOGOTIPO` salvo como `.png` e enviado com `SendFile`.
 * Por isso não há schema Zod aqui — não há payload para traduzir.
 *
 * Empresa sem logotipo cadastrado volta com corpo vazio: isso é `null`
 * (ausência de logo), não erro.
 */
export async function buscarLogo(codeCompany: string): Promise<string | null> {
  const { data } = await tenantApi.get<Blob>(`/v1/application/photocompany/${codeCompany}`, {
    responseType: 'blob',
  });

  if (!data || data.size === 0) return null;

  return blobToDataUri(data, 'image/png');
}
