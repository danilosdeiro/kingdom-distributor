interface PapelInfo {
  papel: string;
  objetivo: string;
}

let papelAtual: PapelInfo | null = null;

export const gameState = {
  setMeuPapel: (papelInfo: PapelInfo) => {
    papelAtual = papelInfo;
  },
  getMeuPapel: (): PapelInfo | null => {
    return papelAtual;
  },
};