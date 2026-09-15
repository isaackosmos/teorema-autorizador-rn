import { empresaListSchema } from '@/features/empresa/schemas/empresa.schema';
import { tenantApi } from '@/shared/lib/http/client';
import { ContractError } from '@/shared/lib/http/errors';
import { blobToDataUri } from '@/shared/lib/image/data-uri';

/**
 * Empresas liberadas para o usuário. A escolhida define a empresa corrente e é
 * pré-requisito do menu (docs/analise §3.1, item 5).
 */
export async function listarEmpresasDoUsuario(userCode: string) {
  const { data } = await tenantApi.get(`/v1/application/companyfromuser/${userCode}`);

  const empresas = empresaListSchema.safeParse(data);
  if (!empresas.success) {
    throw new ContractError('Resposta inesperada do servidor ao listar as empresas.', data);
  }

  return empresas.data;
}

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
