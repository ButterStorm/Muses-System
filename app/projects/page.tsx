'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { listProjects } from '@/services/projectService';
import type { Project } from '@/services/projectService';
import { Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function ProjectsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { deleteProject, renameProject, createProject } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      listProjects(user.id)
        .then(setProjects)
        .catch((e) => console.error('Failed to load projects:', e))
        .finally(() => setLoading(false));
    }
  }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    const project = await createProject(user.id, `项目 ${projects.length + 1}`);
    router.push(`/canvas?projectId=${project.id}`);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    try {
      await renameProject(id, editName.trim());
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: editName.trim() } : p)));
    } catch (e) { console.error('Rename failed:', e); }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeletingId(null);
    } catch (e) { console.error('Delete failed:', e); }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHr < 24) return `${diffHr} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getNodeStats = (project: Project) => {
    const nodes = project.flow_data?.nodes || [];
    const images = nodes.filter((n: any) => n.type === 'imageNode' || n.type === 'imageInputNode').length;
    const texts = nodes.filter((n: any) => n.type === 'textNode' || n.type === 'textInputNode').length;
    const others = nodes.length - images - texts;
    const parts: string[] = [];
    if (texts) parts.push(`${texts} 文本`);
    if (images) parts.push(`${images} 图片`);
    if (others) parts.push(`${others} 其他`);
    return parts.length ? parts.join(' · ') : '空白画布';
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-[1.5px] border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="px-6 lg:px-12 py-6 flex items-center justify-between bg-white border-b border-gray-100">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900">我的作品</h1>
            <p className="text-[11px] text-gray-400 mt-0.5 tracking-wider uppercase">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="h-10 px-5 bg-gray-900 text-white font-semibold text-[13px] tracking-wide hover:bg-black transition-colors flex items-center gap-2 active:scale-[0.97]"
        >
          <Plus size={15} />
          新建项目
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 lg:px-12 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-6 h-6 border-[1.5px] border-gray-200 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center mb-6">
              <Plus size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-600 text-sm mb-1">还没有作品</p>
            <p className="text-gray-400 text-[13px] mb-8">创建你的第一个项目开始创作</p>
            <button
              onClick={handleCreate}
              className="h-10 px-6 bg-gray-900 text-white font-semibold text-[13px] tracking-wide hover:bg-black transition-colors flex items-center gap-2"
            >
              <Plus size={15} />
              新建项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project, idx) => {
              const isHovered = hoveredId === project.id;
              const isEditing = editingId === project.id;
              const isDeleting = deletingId === project.id;

              return (
                <div
                  key={project.id}
                  className="bg-white p-6 group cursor-pointer relative transition-all duration-150 hover:bg-gray-50"
                  onMouseEnter={() => setHoveredId(project.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => !isEditing && !isDeleting && router.push(`/canvas?projectId=${project.id}`)}
                >
                  <span className="text-[10px] font-mono text-gray-300 tracking-widest mb-4 block">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {isEditing ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(project.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="bg-transparent border-b border-gray-300 text-gray-900 text-[15px] font-semibold w-full pb-1 mb-3 focus:outline-none focus:border-gray-900"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3 className="text-[15px] font-semibold text-gray-900 mb-1 truncate group-hover:text-emerald-600 transition-colors">
                      {project.name}
                    </h3>
                  )}

                  <p className="text-[12px] text-gray-400 mb-5">{getNodeStats(project)}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">{formatDate(project.updated_at)}</span>

                    <div
                      className={`flex items-center gap-1 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isDeleting ? (
                        <>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="px-2.5 py-1 text-[10px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors rounded"
                          >
                            删除
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(project.id); setEditName(project.name); }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                            title="重命名"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          </button>
                          <button
                            onClick={() => setDeletingId(project.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className={`absolute bottom-0 left-6 right-6 h-[2px] bg-emerald-500 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-4 border-t border-gray-100 bg-white">
        <p className="text-[11px] text-gray-400">
          &copy; {new Date().getFullYear()} MusesSystem
        </p>
      </footer>
    </div>
  );
}
