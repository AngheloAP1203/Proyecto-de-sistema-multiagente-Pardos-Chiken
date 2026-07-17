import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif'
});

export default function Mermaid({ chart, id = "mermaid-chart" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && chart) {
      // Limpia el contenedor antes de renderizar (evita renderizados duplicados en React StrictMode)
      containerRef.current.removeAttribute('data-processed');
      containerRef.current.innerHTML = '';
      
      const renderChart = async () => {
        try {
          const { svg } = await mermaid.render(id, chart);
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } catch (error) {
          console.error("Error rendering mermaid chart", error);
        }
      };
      
      renderChart();
    }
  }, [chart, id]);

  return <div ref={containerRef} className="mermaid" />;
}
