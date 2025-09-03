interface PapelInfo {
  papel: string;
  objetivo: string;
}

// Usamos um truque simples para criar uma variável "global" reativa.
let papelAtual: PapelInfo | null = null;

export const gameState = {
  setMeuPapel: (papelInfo: PapelInfo) => {
    papelAtual = papelInfo;
  },
  getMeuPapel: (): PapelInfo | null => {
    return papelAtual;
  },
};