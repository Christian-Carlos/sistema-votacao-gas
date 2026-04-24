function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

/* =========================
   UTILITÁRIOS
========================= */

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarCPF(valor) {
  return String(valor || "").replace(/\D/g, "").trim();
}

function normalizarEmail(valor) {
  return String(valor || "").toLowerCase().trim();
}

function obterAbaEleitores_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DADOSELEITORES");
  if (!aba) throw new Error("Aba DADOSELEITORES não encontrada");
  return aba;
}

function obterAbaVotos_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DADOS");
  if (!aba) throw new Error("Aba DADOS não encontrada");
  return aba;
}

/* =========================
   LEITURA DE DADOS
========================= */

function lerEleitores_() {
  const aba = obterAbaEleitores_();
  SpreadsheetApp.flush();

  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  // A:D = Email, Nome, CPF, Status
  return aba.getRange(2, 1, ultimaLinha - 1, 4).getDisplayValues();
}

function lerVotos_() {
  const aba = obterAbaVotos_();
  SpreadsheetApp.flush();

  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  // A:D = Data, Nome, CPF, Email
  return aba.getRange(2, 1, ultimaLinha - 1, 4).getDisplayValues();
}

/* =========================
   BUSCAS
========================= */

function localizarEleitorNaListaBranca_(cpf, email) {
  const registros = lerEleitores_();

  let porCpf = null;
  let porEmail = null;
  let porCpfEmail = null;

  for (let i = 0; i < registros.length; i++) {
    const linha = registros[i];
    const emailExistente = normalizarEmail(linha[0]); // A
    const cpfExistente = normalizarCPF(linha[2]);     // C
    const linhaReal = i + 2;

    if (!cpfExistente && !emailExistente) continue;

    if (!porCpf && cpfExistente && cpfExistente === cpf) {
      porCpf = {
        encontrado: true,
        linha: linhaReal,
        email: emailExistente,
        cpf: cpfExistente
      };
    }

    if (!porEmail && emailExistente && emailExistente === email) {
      porEmail = {
        encontrado: true,
        linha: linhaReal,
        email: emailExistente,
        cpf: cpfExistente
      };
    }

    if (cpf && email && cpfExistente === cpf && emailExistente === email) {
      porCpfEmail = {
        encontrado: true,
        linha: linhaReal,
        email: emailExistente,
        cpf: cpfExistente
      };
      break;
    }
  }

  return {
    porCpf: porCpf,
    porEmail: porEmail,
    porCpfEmail: porCpfEmail
  };
}

function localizarVotoNoDados_(cpf, email) {
  const registros = lerVotos_();

  let porCpf = null;
  let porEmail = null;
  let porCpfEmail = null;

  for (let i = 0; i < registros.length; i++) {
    const linha = registros[i];
    const cpfExistente = normalizarCPF(linha[2]);     // C
    const emailExistente = normalizarEmail(linha[3]); // D
    const linhaReal = i + 2;

    if (!cpfExistente && !emailExistente) continue;

    if (!porCpf && cpf && cpfExistente === cpf) {
      porCpf = {
        encontrado: true,
        linha: linhaReal,
        cpf: cpfExistente,
        email: emailExistente
      };
    }

    if (!porEmail && email && emailExistente === email) {
      porEmail = {
        encontrado: true,
        linha: linhaReal,
        cpf: cpfExistente,
        email: emailExistente
      };
    }

    if (cpf && email && cpfExistente === cpf && emailExistente === email) {
      porCpfEmail = {
        encontrado: true,
        linha: linhaReal,
        cpf: cpfExistente,
        email: emailExistente
      };
      break;
    }
  }

  return {
    porCpf: porCpf,
    porEmail: porEmail,
    porCpfEmail: porCpfEmail
  };
}

function jaVotouNoDados_(cpf, email) {
  const busca = localizarVotoNoDados_(cpf, email);
  return !!busca.porCpfEmail;
}

/* =========================
   VALIDAÇÕES
========================= */

function verificarCPF(cpfDigitado, emailDigitado) {
  try {
    const cpf = normalizarCPF(cpfDigitado);
    const email = normalizarEmail(emailDigitado);

    if (!cpf) {
      return { status: "invalido", mensagem: "Informe o CPF" };
    }

    const buscaLista = localizarEleitorNaListaBranca_(cpf, "");
    if (!buscaLista.porCpf) {
      return { status: "invalido", mensagem: "CPF não autorizado" };
    }

    const buscaVoto = localizarVotoNoDados_(cpf, "");
    if (buscaVoto.porCpf) {
      return { status: "existe", mensagem: "Você já votou!" };
    }

    if (cpf && email && jaVotouNoDados_(cpf, email)) {
      return { status: "existe", mensagem: "Você já votou!" };
    }

    return { status: "ok", mensagem: "CPF autorizado" };
  } catch (erro) {
    return { status: "invalido", mensagem: erro.message || "Erro ao verificar CPF" };
  }
}

function validarEmail(emailDigitado, cpfDigitado) {
  try {
    const email = normalizarEmail(emailDigitado);
    const cpf = normalizarCPF(cpfDigitado);
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      return { status: "invalido", mensagem: "Informe o e-mail" };
    }

    if (!regex.test(email)) {
      return { status: "invalido", mensagem: "E-mail inválido" };
    }

    const buscaLista = localizarEleitorNaListaBranca_("", email);
    if (!buscaLista.porEmail) {
      return { status: "invalido", mensagem: "E-mail não autorizado" };
    }

    const buscaVoto = localizarVotoNoDados_("", email);
    if (buscaVoto.porEmail) {
      return { status: "existe", mensagem: "E-mail utilizado" };
    }

    if (cpf && email && jaVotouNoDados_(cpf, email)) {
      return { status: "existe", mensagem: "E-mail utilizado" };
    }

    return { status: "ok", mensagem: "E-mail autorizado" };
  } catch (erro) {
    return { status: "invalido", mensagem: erro.message || "Erro ao verificar e-mail" };
  }
}

function validarEleitor(cpfDigitado, emailDigitado) {
  try {
    const cpf = normalizarCPF(cpfDigitado);
    const email = normalizarEmail(emailDigitado);

    if (!cpf) {
      return { status: "invalido", mensagem: "Informe o CPF" };
    }

    const validacaoEmail = validarEmail(email, cpf);
    if (validacaoEmail.status !== "ok" && validacaoEmail.status !== "existe") {
      return { status: "invalido", mensagem: validacaoEmail.mensagem };
    }

    const buscaLista = localizarEleitorNaListaBranca_(cpf, email);
    if (!buscaLista.porCpfEmail) {
      return { status: "invalido", mensagem: "CPF e e-mail não conferem" };
    }

    if (jaVotouNoDados_(cpf, email)) {
      return { status: "existe", mensagem: "Você já votou" };
    }

    return { status: "ok", mensagem: "Eleitor autorizado" };
  } catch (erro) {
    return { status: "invalido", mensagem: erro.message || "Erro ao validar eleitor" };
  }
}

/* =========================
   REGRAS DE VOTAÇÃO
========================= */

function normalizarVotosParaSalvar_(votos) {
  const categorias = [
    "Literatura",
    "Pesquisa/identidade/memoria",
    "Cultura Popular",
    "Associação comercial/industrial/agronegócio/clube de serviços",
    "Comunidades Tradicionais",
    "Dança",
    "Musica",
    "Audiovisual/Fotografia/Comunicação e Cultura digital",
    "Artes Plásticas",
    "Artesanato",
    "Teatro/Circo",
    "Patrimônio Cultural",
    "Movimento Hip Hop"
  ];

  const resultado = {};
  let totalSelecionados = 0;

  for (let i = 0; i < categorias.length; i++) {
    const categoria = categorias[i];
    const valor = votos && votos[categoria];

    let lista = [];

    if (Array.isArray(valor)) {
      lista = valor
        .map(item => normalizarTexto(item))
        .filter(item => item);
    } else if (typeof valor === "string" && valor.trim()) {
      lista = valor.split("|").map(item => normalizarTexto(item)).filter(item => item);
    }

    lista = [...new Set(lista)];

    if (lista.length > 1) {
      throw new Error("Máximo de 1 candidato por categoria.");
    }

    totalSelecionados += lista.length;
    resultado[categoria] = lista.join(" | ");
  }

  if (totalSelecionados > 13) {
    throw new Error("Máximo de 13 candidatos no total.");
  }

  return {
    votosNormalizados: resultado,
    totalSelecionados: totalSelecionados
  };
}

/* =========================
   SALVAR VOTO
========================= */

function salvarDados(dados) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const abaVotos = obterAbaVotos_();

    const nome = normalizarTexto(dados.nome);
    const cpf = normalizarCPF(dados.cpf);
    const email = normalizarEmail(dados.email);

    if (!nome || !cpf || !email) {
      return "Preencha todos os dados!";
    }

    const validacao = validarEleitor(cpf, email);
    if (validacao.status !== "ok") {
      return validacao.mensagem;
    }

    const pacoteVotos = normalizarVotosParaSalvar_(dados.votos || {});
    const votos = pacoteVotos.votosNormalizados;

    if (pacoteVotos.totalSelecionados === 0) {
      return "Selecione pelo menos 1 candidato.";
    }

    abaVotos.appendRow([
      new Date(),
      nome,
      cpf,
      email,
      votos["Literatura"] || "",
      votos["Pesquisa/identidade/memoria"] || "",
      votos["Cultura Popular"] || "",
      votos["Associação comercial/industrial/agronegócio/clube de serviços"] || "",
      votos["Comunidades Tradicionais"] || "",
      votos["Dança"] || "",
      votos["Musica"] || "",
      votos["Audiovisual/Fotografia/Comunicação e Cultura digital"] || "",
      votos["Artes Plásticas"] || "",
      votos["Artesanato"] || "",
      votos["Teatro/Circo"] || "",
      votos["Patrimônio Cultural"] || "",
      votos["Movimento Hip Hop"] || ""
    ]);

    SpreadsheetApp.flush();

    return "Votação realizada";
  } catch (erro) {
    return erro.message || "Erro ao salvar votação";
  } finally {
    lock.releaseLock();
  }
}
