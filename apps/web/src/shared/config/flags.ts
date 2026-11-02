export const flags = {
  aiRevision: true,
  versionHistory: true,
  comments: false,
  devtools:
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === 'true',
};
