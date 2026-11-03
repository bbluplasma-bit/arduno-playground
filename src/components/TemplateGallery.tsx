import React from 'react';
import { RobotProject } from '../types';
import { DEFAULT_BIPED_PROJECT, DEFAULT_ARM_PROJECT } from '../data/defaultProjects';
import { DEFAULT_40_PART_TITAN_PROJECT } from '../data/robot40Parts';
import { Copy, Sparkles } from 'lucide-react';

interface TemplateGalleryProps {
  onLoadTemplate: (project: RobotProject) => void;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onLoadTemplate }) => {
  const templates = [
    { ...DEFAULT_BIPED_PROJECT, id: 'tmp_biped' },
    { ...DEFAULT_ARM_PROJECT, id: 'tmp_arm' },
    { ...DEFAULT_40_PART_TITAN_PROJECT, id: 'tmp_titan' },
  ];

  return (
    <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        Template Gallery
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {templates.map((tmpl) => (
          <div key={tmpl.id} className="bg-[#181f33] border border-[#27324c] rounded-lg p-4 flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-bold text-white mb-1">{tmpl.name}</h3>
              <p className="text-[10px] text-slate-400 line-clamp-2">{tmpl.description}</p>
            </div>
            <button
              onClick={() =>
                onLoadTemplate({
                  ...JSON.parse(JSON.stringify(tmpl)),
                  id: `proj_tmpl_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
                })
              }
              className="mt-auto px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 rounded text-[10px] font-semibold flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3 h-3" /> Load Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
