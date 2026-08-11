// cytoscape-dagre ships no types of its own.
declare module 'cytoscape-dagre' {
  import type cytoscape from 'cytoscape';
  const extension: cytoscape.Ext;
  export default extension;
}
