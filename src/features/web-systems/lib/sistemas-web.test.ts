import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { mesmaOrigem, origemDe, urlDoSistema } from '@/features/web-systems/lib/sistemas-web';

/**
 * `mesmaOrigem` é o que impede a sessão de ser injetada em página estranha se
 * o HTML navegar para fora (docs/decisao-webview-sessao §9, §13.4). Um erro
 * aqui entrega o JWT do usuário a terceiro **sem sintoma nenhum** — é o caso
 * mais caro da suíte, não o mais raro.
 */
const TENANT = 'https://orion.cliente.com.br:8443';

describe('origemDe', () => {
  test('extrai esquema, host e porta', () => {
    assert.equal(origemDe('https://orion.cliente.com.br:8443/v2/x/index.html'), TENANT);
    assert.equal(origemDe('http://10.0.0.5:9000/a?b=1#c'), 'http://10.0.0.5:9000');
  });

  test('normaliza para minúsculas', () => {
    assert.equal(origemDe('HTTPS://Orion.Cliente.COM.BR:8443/x'), TENANT);
  });

  test('espaço em volta não atrapalha', () => {
    assert.equal(origemDe('  https://orion.cliente.com.br:8443/x  '), TENANT);
  });

  test('URL sem caminho funciona', () => {
    assert.equal(origemDe('https://orion.cliente.com.br:8443'), TENANT);
  });

  test('a porta faz parte da origem', () => {
    assert.notEqual(origemDe('https://a.b:8443/x'), origemDe('https://a.b:9443/x'));
  });

  test('o que não é http(s) vira null', () => {
    // `about:`, `data:`, `intent:` e afins caem aqui de propósito.
    const naoNavegaveis = [
      'about:blank',
      'data:text/html,<b>x</b>',
      'intent://x#Intent;scheme=http;end',
      'javascript:alert(1)',
      'file:///android_asset/x.html',
      'ftp://a.b/x',
      '//a.b/x',
      '/caminho/relativo',
      '',
      '   ',
    ];

    for (const url of naoNavegaveis) {
      assert.equal(origemDe(url), null, `${url} não pode virar origem`);
    }
  });
});

describe('mesmaOrigem — o guarda do token', () => {
  test('a própria origem do tenant passa', () => {
    assert.equal(mesmaOrigem(urlDoSistema(TENANT, 'autorizador'), TENANT), true);
    assert.equal(mesmaOrigem(`${TENANT}/outra/pagina.html`, TENANT), true);
  });

  test('caixa diferente na URL continua sendo a mesma origem', () => {
    assert.equal(mesmaOrigem('HTTPS://ORION.CLIENTE.COM.BR:8443/x', TENANT), true);
  });

  test('host diferente é recusado', () => {
    assert.equal(mesmaOrigem('https://atacante.com.br:8443/x', TENANT), false);
  });

  test('sufixo e subdomínio parecidos são recusados', () => {
    // Prefixo/sufixo de string não é origem: a comparação tem de ser exata.
    assert.equal(mesmaOrigem('https://orion.cliente.com.br.atacante.io/x', TENANT), false);
    assert.equal(mesmaOrigem('https://mal.orion.cliente.com.br:8443/x', TENANT), false);
  });

  test('porta diferente é recusada', () => {
    assert.equal(mesmaOrigem('https://orion.cliente.com.br:9443/x', TENANT), false);
  });

  test('downgrade de https para http é recusado', () => {
    assert.equal(mesmaOrigem('http://orion.cliente.com.br:8443/x', TENANT), false);
  });

  test('esquema não navegável é recusado', () => {
    for (const url of ['about:blank', 'data:text/html,x', 'javascript:alert(1)', 'file:///x']) {
      assert.equal(mesmaOrigem(url, TENANT), false, `${url} não pode receber a sessão`);
    }
  });

  test('origem vazia não libera nada', () => {
    // Caso degenerado: sem tenant resolvido, ninguém recebe a sessão.
    assert.equal(mesmaOrigem(`${TENANT}/x`, ''), false);
    assert.equal(mesmaOrigem('about:blank', ''), false);
  });
});

describe('urlDoSistema', () => {
  test('monta a rota sem fragmento e sem query', () => {
    // O original carregava a sessão no fragmento da URL (docs/analise §5.3).
    const url = urlDoSistema(TENANT, 'autcompras');
    assert.equal(url, `${TENANT}/v2/htmlresponse/autcompras/index.html`);
    assert.doesNotMatch(url, /[#?]/);
  });

  test('barra sobrando na base não vira barra dupla', () => {
    const url = urlDoSistema(`${TENANT}/`, 'autcotacao');
    assert.equal(url, `${TENANT}/v2/htmlresponse/autcotacao/index.html`);
  });

  test('a URL montada é sempre da origem do tenant', () => {
    for (const sistema of ['autcompras', 'autcotacao', 'reqcompras', 'autorizador'] as const) {
      assert.equal(mesmaOrigem(urlDoSistema(TENANT, sistema), TENANT), true, sistema);
    }
  });
});
