import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './EnvironmentSelector.css';

export function EnvironmentSelector() {
  const { environments, activeEnvironmentId, setActiveEnvironment, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = environments.find((e) => e.id === activeEnvironmentId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="env-selector" ref={ref}>
      <button className="env-selector-btn" onClick={() => setOpen(!open)}>
        <Globe size={14} />
        <span>{active?.name ?? t.environment.noEnvironment}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="env-dropdown">
          <button
            className={`env-option ${activeEnvironmentId === null ? 'active' : ''}`}
            onClick={() => {
              setActiveEnvironment(null);
              setOpen(false);
            }}
          >
            {t.environment.noEnvironment}
          </button>
          {environments.map((env) => (
            <button
              key={env.id}
              className={`env-option ${activeEnvironmentId === env.id ? 'active' : ''}`}
              onClick={() => {
                setActiveEnvironment(env.id);
                setOpen(false);
              }}
            >
              {env.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
