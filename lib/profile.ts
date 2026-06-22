import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/storage';

export type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
};

export async function getUserProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateUserProfile({
  userId,
  displayName,
  currentAvatarUrl,
  avatarFile,
}: {
  userId: string;
  displayName: string;
  currentAvatarUrl: string;
  avatarFile: File | null;
}): Promise<ProfileRow> {
  const avatarUrl = avatarFile ? await uploadImage(avatarFile) : currentAvatarUrl;
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
    })
    .eq('user_id', userId)
    .select('display_name, avatar_url')
    .maybeSingle();

  if (error) throw new Error(error.message || '资料保存失败');
  if (!data) throw new Error('资料不存在，请确认 profiles 初始化完成');
  return data;
}
