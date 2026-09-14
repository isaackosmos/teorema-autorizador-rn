import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  baseDadosListSchema,
  empresaLicenciadaSchema,
  enderecosServidorSchema,
  loginResponseSchema,
  MotivoLicenca,
  registroResultadoSchema,
} from '@/features/auth/schemas/auth.schema';

describe('loginResponseSchema', () => {
  const resposta = { TOKEN: 'jwt.abc.123', USUARIO_ID: 7, USUARIO_CODIGO: '5' };

  test('o campo TOKEN do Orion vira jwt', () => {
    // Não é typo do servidor: o JWT chega num campo chamado `TOKEN`.
    assert.equal(loginResponseSchema.parse(resposta).jwt, 'jwt.abc.123');
  });

  test('o código do usuário é preenchido com zeros à esquerda', () => {
    assert.equal(loginResponseSchema.parse(resposta).code, '005');
    assert.equal(loginResponseSchema.parse({ ...resposta, USUARIO_CODIGO: '42' }).code, '042');
  });

  test('código já com três dígitos não é alterado', () => {
    assert.equal(loginResponseSchema.parse({ ...resposta, USUARIO_CODIGO: '123' }).code, '123');
  });

  test('código com mais de três dígitos não é truncado', () => {
    assert.equal(loginResponseSchema.parse({ ...resposta, USUARIO_CODIGO: '1234' }).code, '1234');
  });

  test('id em texto é coagido para número', () => {
    assert.equal(loginResponseSchema.parse({ ...resposta, USUARIO_ID: '7' }).id, 7);
  });

  test('nome ausente vira string vazia e deviceStatus ausente vira null', () => {
    const usuario = loginResponseSchema.parse(resposta);
    assert.equal(usuario.name, '');
    assert.equal(usuario.deviceStatus, null);
  });

  test('resposta sem TOKEN é recusada', () => {
    const { TOKEN: _token, ...semToken } = resposta;
    assert.equal(loginResponseSchema.safeParse(semToken).success, false);
  });
});

describe('empresaLicenciadaSchema', () => {
  test('código numérico vira string e id vira número', () => {
    const empresa = empresaLicenciadaSchema.parse({ CLIFOR_CODIGO: 1, CLIFOR_ID: '99' });
    assert.equal(empresa.code, '1');
    assert.equal(empresa.id, 99);
  });

  test('o 200 com corpo vazio é recusado aqui, para virar 404 na borda', () => {
    // `companyinformation` responde 200 com `{}` quando o documento não é
    // licenciado (docs/analise §3.1); quem traduz para ApiError é a api.
    assert.equal(empresaLicenciadaSchema.safeParse({}).success, false);
  });
});

describe('enderecosServidorSchema', () => {
  test('só o primário é obrigatório', () => {
    const enderecos = enderecosServidorSchema.parse({ SERVER_URL_PRIMARY: 'https://a.teorema' });
    assert.equal(enderecos.primary, 'https://a.teorema');
    assert.equal(enderecos.secondary, null);
    assert.equal(enderecos.print, null);
  });

  test('secundário só de espaço é ausência, e não endereço vazio', () => {
    // Um secundário `''` faria o fallback tentar uma baseURL vazia.
    const enderecos = enderecosServidorSchema.parse({
      SERVER_URL_PRIMARY: 'https://a.teorema',
      SERVER_URL_SECONDARY: '   ',
    });
    assert.equal(enderecos.secondary, null);
  });

  test('sem primário não há o que testar no ping', () => {
    assert.equal(enderecosServidorSchema.safeParse({ SERVER_URL_PRIMARY: '' }).success, false);
    assert.equal(enderecosServidorSchema.safeParse({}).success, false);
  });
});

describe('baseDadosListSchema', () => {
  test('token da base e nome do cliente são traduzidos', () => {
    const bases = baseDadosListSchema.parse([{ DB_TOKEN: 'tok-1', CUSTOMER_NAME: ' Matriz ' }]);
    assert.equal(bases[0]?.token, 'tok-1');
    assert.equal(bases[0]?.nome, 'Matriz');
  });

  test('base sem token é recusada', () => {
    assert.equal(baseDadosListSchema.safeParse([{ DB_TOKEN: '' }]).success, false);
  });

  test('nenhuma base é lista vazia, não erro', () => {
    assert.deepEqual(baseDadosListSchema.parse([]), []);
  });
});

describe('registroResultadoSchema — união discriminada por `ok`', () => {
  /**
   * O central responde **200 com uma palavra em texto puro** quando recusa
   * (docs/analise §3.1). Quem chama decide por `ok`, nunca comparando texto.
   */
  for (const motivo of Object.values(MotivoLicenca)) {
    test(`recusa "${motivo}" vira ok:false com o motivo`, () => {
      const resultado = registroResultadoSchema.parse(motivo);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.ok === false && resultado.motivo, motivo);
    });
  }

  test('registro criado vira ok:true com id numérico', () => {
    const resultado = registroResultadoSchema.parse({ id: '31', expiration: null });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.ok === true && resultado.registerId, 31);
  });

  test('licença paga vem sem expiration e a validade fica null', () => {
    const resultado = registroResultadoSchema.parse({ id: 31 });
    assert.equal(resultado.ok === true && resultado.registerExpiration, null);
  });

  test('demo tem validade, convertida para ISO na borda', () => {
    const resultado = registroResultadoSchema.parse({ id: 31, expiration: '31/12/2026' });
    assert.equal(resultado.ok === true && resultado.registerExpiration, '2026-12-31');
  });

  test('palavra fora da lista de motivos é recusada', () => {
    // Motivo novo do servidor precisa aparecer, não virar recusa silenciosa.
    assert.equal(registroResultadoSchema.safeParse('sei-la').success, false);
  });
});
