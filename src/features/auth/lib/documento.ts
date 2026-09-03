/**
 * CNPJ/CPF: dígitos, máscara e dígito verificador.
 *
 * O original formatava o campo a cada tecla (`EdtDocumentoTyping` →
 * `Formatar(EdtDocumento, TFormato.CNPJorCPF)`) e não conferia dígito
 * verificador nenhum: qualquer texto seguia para o servidor central. Aqui a
 * regra é conferida uma vez, no schema (docs/plano-migracao A2).
 *
 * O documento é enviado ao Orion **com máscara**: é a forma gravada em
 * `CLIENTES_FORNECEDORES.CLIFOR_DOCUMENTO`, que é o valor comparado por
 * `companyinformation` e por `getserverurl` (docs/analise §5.1).
 */

const CPF_DIGITOS = 11;
const CNPJ_DIGITOS = 14;

const CPF_PESOS_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CPF_PESOS_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** Só os dígitos — o usuário pode digitar com ou sem máscara. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Dígito verificador de CPF/CNPJ: soma ponderada módulo 11. */
function digitoVerificador(digitos: string, pesos: readonly number[]): number {
  const soma = pesos.reduce((total, peso, i) => total + Number(digitos[i] ?? 0) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** `111.111.111-11` passa na conta do módulo 11, mas não é documento. */
function temTodosOsDigitosIguais(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos);
}

function isCpfValido(digitos: string): boolean {
  if (digitos.length !== CPF_DIGITOS || temTodosOsDigitosIguais(digitos)) return false;

  return (
    digitoVerificador(digitos, CPF_PESOS_1) === Number(digitos[9]) &&
    digitoVerificador(digitos, CPF_PESOS_2) === Number(digitos[10])
  );
}

function isCnpjValido(digitos: string): boolean {
  if (digitos.length !== CNPJ_DIGITOS || temTodosOsDigitosIguais(digitos)) return false;

  return (
    digitoVerificador(digitos, CNPJ_PESOS_1) === Number(digitos[12]) &&
    digitoVerificador(digitos, CNPJ_PESOS_2) === Number(digitos[13])
  );
}

/** Aceita CPF (11 dígitos) ou CNPJ (14), com ou sem máscara. */
export function isDocumentoValido(valor: string): boolean {
  const digitos = somenteDigitos(valor);
  return isCpfValido(digitos) || isCnpjValido(digitos);
}

/** `12345678000195` → `12.345.678/0001-95` · `12345678909` → `123.456.789-09`. */
export function formatarDocumento(valor: string): string {
  const digitos = somenteDigitos(valor);

  if (digitos.length === CPF_DIGITOS) {
    return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  if (digitos.length === CNPJ_DIGITOS) {
    return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return digitos;
}
