/** Evita voltar página ao apagar campo vazio (Chrome). */
export function blockEmptyBackspaceNav(e) {
  if (e.key !== 'Backspace') return
  const el = e.target
  if (el instanceof HTMLInputElement && el.value === '') {
    e.preventDefault()
  }
}
