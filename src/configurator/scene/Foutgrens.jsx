// Vangt fouten in (delen van) de 3D-weergave op, zodat de rest van de
// configurator blijft werken in plaats van de hele pagina leeg te maken.
import { Component } from 'react'

export class Foutgrens extends Component {
  state = { fout: null }

  static getDerivedStateFromError(fout) {
    return { fout }
  }

  componentDidCatch(fout) {
    console.error(`${this.props.naam || '3D-onderdeel'} kon niet laden:`, fout)
  }

  render() {
    return this.state.fout ? (this.props.fallback ?? null) : this.props.children
  }
}
