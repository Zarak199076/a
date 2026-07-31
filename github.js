const { Octokit } = require('@octokit/rest');
const config = require('./config');

const octokit = new Octokit({ auth: config.githubToken });

async function getFile(path) {
  try {
    const res = await octokit.repos.getContent({
      owner: config.githubOwner,
      repo: config.githubRepo,
      path,
      ref: config.githubBranch,
    });
    return {
      content: Buffer.from(res.data.content, 'base64').toString('utf8'),
      sha: res.data.sha,
    };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function putFile(path, contentBuffer, message, sha) {
  await octokit.repos.createOrUpdateFileContents({
    owner: config.githubOwner,
    repo: config.githubRepo,
    path,
    message,
    content: contentBuffer.toString('base64'),
    branch: config.githubBranch,
    ...(sha ? { sha } : {}),
  });
}

async function uploadBadgeImage(badgeId, ext, imageBuffer) {
  const path = `${config.badgesImageDir}/${badgeId}.${ext}`;
  await putFile(path, imageBuffer, `Add badge image: ${badgeId}`);
  return `https://raw.githubusercontent.com/${config.githubOwner}/${config.githubRepo}/${config.githubBranch}/${path}`;
}

async function addBadgeToUser(userId, badgeEntry) {
  const file = await getFile(config.badgesJsonPath);
  const data = file ? JSON.parse(file.content) : {};
  if (!Array.isArray(data[userId])) data[userId] = [];
  data[userId].unshift(badgeEntry);
  const updated = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  await putFile(
    config.badgesJsonPath,
    updated,
    `Add badge "${badgeEntry.id}" for user ${userId}`,
    file ? file.sha : undefined
  );
}

module.exports = { uploadBadgeImage, addBadgeToUser };
