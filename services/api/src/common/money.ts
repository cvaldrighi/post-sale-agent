/** "R$ 189,90" (o Intl usa um espaço especial depois do R$; trocamos por um espaço comum). */
export function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/\u00a0/g, ' ');
}
