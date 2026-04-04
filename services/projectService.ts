import { supabase } from '@/lib/supabase';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  flow_data: {
    nodes: any[];
    edges: any[];
    viewport: { x: number; y: number; zoom: number };
  };
  created_at: string;
  updated_at: string;
}

export const createProject = async (userId: string, name: string = '未命名项目'): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw new Error('创建项目失败: ' + error.message);
  return data;
};

export const listProjects = async (userId: string): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('获取项目列表失败: ' + error.message);
  return data || [];
};

export const getProject = async (id: string): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error('获取项目失败: ' + error.message);
  return data;
};

export const saveProject = async (id: string, flowData: Project['flow_data']): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update({ flow_data: flowData, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error('保存项目失败: ' + error.message);
};

export const deleteProject = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  if (error) throw new Error('删除项目失败: ' + error.message);
};

export const renameProject = async (id: string, name: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error('重命名失败: ' + error.message);
};
