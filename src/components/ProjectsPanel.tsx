import React, { useRef, useState } from 'react';
import { RobotProject } from '../types';
import { exportPartsToOBJ, exportPartsToSTL, downloadFile } from '../utils/meshFormatUtils';
import { FolderOpen, Plus, Trash2, Download, Upload, Copy, Box, CheckCircle2, Layers, ArrowRight, Sparkles } from 'lucide-react';
import { TemplateGallery } from './TemplateGallery';

interface ProjectsPanelProps {
  projects: RobotProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onImportProject: (project: RobotProject) => void;
}

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onImportProject,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleExportOBJ = () => {
    if (!activeProject) return;
    const content = exportPartsToOBJ(activeProject.parts, activeProject.name);
    downloadFile(content, `${activeProject.name.toLowerCase().replace(/\s+/g, '_')}.obj`, 'text/plain');
    setExportNotice('Wavefront 3D OBJ file downloaded.');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleExportSTL = () => {
    if (!activeProject) return;
    const content = exportPartsToSTL(activeProject.parts, activeProject.name);
    downloadFile(content, `${activeProject.name.toLowerCase().replace(/\s+/g, '_')}.stl`, 'text/plain');
    setExportNotice('3D Print STL file downloaded.');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleExportProjectJSON = () => {
    if (!activeProject) return;
    const json = JSON.stringify(activeProject, null, 2);
    downloadFile(json, `${activeProject.name.toLowerCase().replace(/\s+/g, '_')}.acs`, 'application/json');
    setExportNotice('Complete .acs Robot Studio Project file downloaded.');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.parts && parsed.servos) {
          onImportProject({
            ...parsed,
            id: Math.random().toString(36).substring(2, 9),
            name: `${parsed.name || 'Imported Robot'} (Copy)`,
          });
          setExportNotice('Project imported successfully!');
          setTimeout(() => setExportNotice(null), 3000);
        } else {
          alert('Invalid .acs project file structure.');
        }
      } catch (err) {
        alert('Could not parse project file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <TemplateGallery onLoadTemplate={onImportProject} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-cyan-400" />
              Project Management & 3D CAD Export
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Store, import, and export robotic models, kinematics configurations, and standard STL / OBJ meshes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".acs,.json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import .ACS File
            </button>
            <button
              onClick={onNewProject}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-cyan-950/50"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>

        {/* Export Notification Toast */}
        {exportNotice && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Active Project CAD Export Box */}
        {activeProject && (
          <div className="bg-[var(--bg-secondary)] border border-cyan-500/40 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-black/30">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-cyan-400 font-mono font-bold">ACTIVE CAD PROJECT:</span>
                <span className="text-base font-bold text-[var(--text-primary)]">{activeProject.name}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{activeProject.description}</p>
              <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] font-mono mt-2">
                <span>{activeProject.parts.length} 3D Mesh Parts</span>
                <span>•</span>
                <span>{activeProject.servos.length} Kinematic Servos</span>
                <span>•</span>
                <span>Target: {activeProject.boardType.toUpperCase()}</span>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportSTL}
                className="px-3.5 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-xs font-semibold flex items-center gap-1.5"
                title="Export ASCII STL for 3D Printing (Cura, PrusaSlicer, Bambu Studio)"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" /> Export STL (3D Print)
              </button>
              <button
                onClick={handleExportOBJ}
                className="px-3.5 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-xs font-semibold flex items-center gap-1.5"
                title="Export Wavefront OBJ for Blender / CAD"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" /> Export OBJ Mesh
              </button>
              <button
                onClick={handleExportProjectJSON}
                className="px-3.5 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                title="Save complete robot configuration, servos, pins and sequences"
              >
                <Download className="w-3.5 h-3.5" /> Save .ACS Project
              </button>
              <button
                onClick={async () => {
                  if (!activeProject) return;
                  const token = prompt('Enter GitHub Personal Access Token (optional for public Gist, or leave blank to copy Gist JSON payload / create via GitHub API):');
                  const jsonContent = JSON.stringify(activeProject, null, 2);
                  const gistPayload = {
                    description: `Arduino Control Studio Robot Project: ${activeProject.name}`,
                    public: true,
                    files: {
                      [`${activeProject.name.toLowerCase().replace(/\s+/g, '_')}.acs.json`]: {
                        content: jsonContent,
                      },
                    },
                  };

                  try {
                    const headers: Record<string, string> = {
                      'Accept': 'application/vnd.github+json',
                      'Content-Type': 'application/json',
                    };
                    if (token && token.trim().length > 10) {
                      headers['Authorization'] = `Bearer ${token.trim()}`;
                    }

                    const res = await fetch('https://api.github.com/gists', {
                      method: 'POST',
                      headers,
                      body: JSON.stringify(gistPayload),
                    });

                    if (res.ok) {
                      const data = await res.json();
                      if (data.html_url) {
                        setExportNotice(`GitHub Gist created successfully! URL: ${data.html_url}`);
                        window.open(data.html_url, '_blank');
                      } else {
                        setExportNotice('Gist created successfully on GitHub.');
                      }
                    } else {
                      navigator.clipboard.writeText(jsonContent);
                      setExportNotice('Project JSON copied to clipboard for GitHub Gist creation.');
                    }
                  } catch (err) {
                    navigator.clipboard.writeText(jsonContent);
                    setExportNotice('Copied project JSON to clipboard (GitHub API request failed).');
                  }
                  setTimeout(() => setExportNotice(null), 5000);
                }}
                className="px-3.5 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                title="Export project JSON directly to a GitHub Gist"
              >
                <Upload className="w-3.5 h-3.5" /> Export to GitHub Gist
              </button>
            </div>
          </div>
        )}

        {/* Project List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            return (
              <div
                key={proj.id}
                className={`p-5 rounded-xl border flex flex-col justify-between gap-4 transition-all ${
                  isActive
                    ? 'bg-[var(--bg-tertiary)] border-cyan-500 shadow-xl shadow-black/40'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-[var(--text-primary)]">{proj.name}</span>
                    {isActive && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold border border-cyan-800">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-3">
                    {proj.description}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-[var(--text-secondary)]">
                    <span className="px-2 py-1 bg-[var(--bg-primary)] rounded border border-[var(--border-color)]">
                      {proj.parts.length} Parts
                    </span>
                    <span className="px-2 py-1 bg-[var(--bg-primary)] rounded border border-[var(--border-color)]">
                      {proj.servos.length} Servos
                    </span>
                    <span className="px-2 py-1 bg-[var(--bg-primary)] rounded border border-[var(--border-color)]">
                      {proj.sequences.length} Sequences
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]/60">
                  <button
                    onClick={() => onSelectProject(proj.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-cyan-600 text-slate-950 font-bold'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]'
                    }`}
                  >
                    {isActive ? 'Current Workstation' : 'Open Project'}
                  </button>

                  {projects.length > 1 && (
                    <button
                      onClick={() => onDeleteProject(proj.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
