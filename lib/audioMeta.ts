/**
 * 从音频URL获取元数据（如封面图、艺术家、标题等）
 */
export async function extractAudioMetadataFromUrl(audioUrl: string) {
  // 这个函数将在客户端使用jsmediatags来提取音频文件的元数据
  if (typeof window !== 'undefined') {
    try {
      // 动态导入jsmediatags库
      const { default: jsmediatags } = await import('jsmediatags');
      
      return new Promise((resolve, reject) => {
        jsmediatags.read(audioUrl, {
          onSuccess: (tags: any) => {
            resolve({
              title: tags.tags.title || '',
              artist: tags.tags.artist || '',
              album: tags.tags.album || '',
              year: tags.tags.year || '',
              genre: tags.tags.genre || '',
              picture: tags.tags.picture ? {
                data: tags.tags.picture.data,
                type: tags.tags.picture.format,
                format: `image/${tags.tags.picture.format}`
              } : null
            });
          },
          onError: (error: any) => {
            console.error("Error reading audio metadata:", error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error("Failed to load jsmediatags:", error);
      return Promise.reject(error);
    }
  }
  
  return Promise.reject(new Error("Can only extract metadata in browser environment"));
}

/**
 * 将图片数据转换为base64 URL
 */
export function convertToBase64Image(imageData: any) {
  if (!imageData || !imageData.data) return null;
  
  const base64String = imageData.data.reduce((data: string, byte: number) => {
    return data + String.fromCharCode(byte);
  }, '');
  
  const mimeType = imageData.format || `image/${imageData.type}`;
  return `data:${mimeType};base64,${btoa(base64String)}`;
}