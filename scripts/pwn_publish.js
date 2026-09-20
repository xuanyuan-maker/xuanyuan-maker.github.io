'use strict';

const fs = require('fs');
const path = require('path');
const fm = require('hexo-front-matter');
const moment = require('moment');
const yaml = require('js-yaml');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
function isDir(p) {
  return exists(p) && fs.statSync(p).isDirectory();
}
function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}
function rmrf(p) {
  if (!exists(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}
function moveDirMerge(src, dest) {
  if (!isDir(src)) return;
  mkdirp(dest);
  // Node 16+ 有 cpSync
  if (fs.cpSync) {
    fs.cpSync(src, dest, { recursive: true, force: true });
    rmrf(src);
    return;
  }
  // fallback: 递归复制
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      moveDirMerge(s, d);
    } else {
      mkdirp(path.dirname(d));
      fs.copyFileSync(s, d);
      fs.unlinkSync(s);
    }
  }
  rmrf(src);
}

function resolvePlaceholder(value, key, replacement) {
  if (typeof value !== 'string') return value;
  const re = new RegExp(`^\\s*\\{\\{\\s*${key}\\s*\\}\\}\\s*$`, 'i');
  if (re.test(value) && typeof replacement === 'string' && replacement.length) {
    return replacement;
  }
  return value;
}

function normalizeDateValue(value) {
  if (value instanceof Date) {
    return moment(value).format('YYYY-MM-DD HH:mm:ss');
  }
  return value;
}

function buildMergedFrontMatter(scaffoldData, draftData) {
  const merged = {};
  for (const key of Object.keys(scaffoldData)) {
    if (key === '_content') continue;
    const v = Object.prototype.hasOwnProperty.call(draftData, key) ? draftData[key] : scaffoldData[key];
    merged[key] = normalizeDateValue(v);
  }
  for (const key of Object.keys(draftData)) {
    if (key === '_content') continue;
    if (!Object.prototype.hasOwnProperty.call(merged, key)) {
      merged[key] = normalizeDateValue(draftData[key]);
    }
  }
  return merged;
}

// 依据 hexo.config.new_post_name 生成相对路径（相对 post_dir）
function renderNewPostPath(pattern, titleSlug, date) {
  const m = moment(date);
  const map = {
    ':title': titleSlug,
    ':year': m.format('YYYY'),
    ':month': m.format('MM'),
    ':i_month': m.format('M'),
    ':day': m.format('DD'),
    ':i_day': m.format('D')
  };
  let rel = pattern || ':title.md';
  for (const [k, v] of Object.entries(map)) rel = rel.split(k).join(v);
  // 保底补 .md
  if (!path.extname(rel)) rel += '.md';
  return rel;
}

// 支持两种 draft 位置：
// 1) source/_drafts/name.md
// 2) source/_drafts/name/name.md
function resolveDraftPath(sourceDir, draftDir, name) {
  const p1 = path.join(sourceDir, draftDir, `${name}.md`);
  if (exists(p1)) return p1;

  const p2 = path.join(sourceDir, draftDir, name, `${name}.md`);
  if (exists(p2)) return p2;

  return null;
}

hexo.extend.console.register(
  'pwnpublish',
  'Publish draft into pwn scaffold (respects new_post_name & post_asset_folder)',
  async function (args) {
    const name = args._ && args._[0];
    if (!name) {
      hexo.log.error('Usage: hexo pwnpublish <draft_name>');
      return;
    }

    const marker = '<!--PWN_CONTENT-->';

    const postDir = hexo.config.post_dir || '_posts';
    const draftDir = hexo.config.draft_dir || '_drafts';
    const newPostName = hexo.config.new_post_name || ':title.md';
    const useAssetFolder = !!hexo.config.post_asset_folder;

    const sourceDir = hexo.source_dir;

    // 1) 找到 draft
    const draftPath = resolveDraftPath(sourceDir, draftDir, name);
    if (!draftPath) {
      hexo.log.error(`Draft not found. Tried: ${path.join(sourceDir, draftDir, name + '.md')} and nested folder style.`);
      return;
    }

    // draft 的资源文件夹（与 md 同名、去掉扩展名）
    const draftAssetDir = draftPath.slice(0, -path.extname(draftPath).length);

    // 2) 解析 draft
    const draftRaw = fs.readFileSync(draftPath, 'utf8');
    const draftParsed = fm.parse(draftRaw);
    const draftBody = draftParsed._content || '';

    // 你传进来的 name 就是你要的 :title（目录名/文件名）
    const titleSlug = name;

    // date：优先 draft 里的 date，否则用当前
    const date = draftParsed.date ? new Date(draftParsed.date) : new Date();

    // 3) 计算目标 post 路径（会遵循 new_post_name）
    const relPostPath = renderNewPostPath(newPostName, titleSlug, date);
    const postPath = path.join(sourceDir, postDir, relPostPath);

    if (exists(postPath)) {
      hexo.log.error(`Post already exists: ${postPath}`);
      return;
    }

    // 目标资源文件夹（与 md 同名、去掉扩展名）
    const postAssetDir = postPath.slice(0, -path.extname(postPath).length);

    mkdirp(path.dirname(postPath));
    if (useAssetFolder) mkdirp(postAssetDir);

    // 4) 渲染 scaffold（pwn），并把正文插入 marker
    const scaffoldDir = hexo.config.scaffold_dir || 'scaffolds';
    const scaffoldRoot = path.isAbsolute(scaffoldDir)
      ? scaffoldDir
      : path.join(hexo.base_dir, scaffoldDir);
    const scaffoldPath = path.join(scaffoldRoot, 'pwn.md');
    if (!exists(scaffoldPath)) {
      hexo.log.error('Scaffold "pwn" not found. 请确认 scaffolds/pwn.md 存在。');
      return;
    }
    const scaffoldRendered = fs.readFileSync(scaffoldPath, 'utf8');

    const scaffoldParsed = fm.parse(scaffoldRendered);
    const scaffoldBody = scaffoldParsed._content || '';

    if (!scaffoldBody.includes(marker)) {
      hexo.log.error(`Marker not found in scaffold body: ${marker}`);
      return;
    }

    // 合并 front-matter：scaffold 为底，draft 覆盖（保留 tags/categories 等）
    // 只对 title/date 占位符做替换
    const scaffoldData = { ...scaffoldParsed };
    delete scaffoldData._content;
    scaffoldData.title = resolvePlaceholder(scaffoldData.title, 'title', draftParsed.title);
    scaffoldData.date = resolvePlaceholder(scaffoldData.date, 'date', draftParsed.date);

    const mergedData = buildMergedFrontMatter(scaffoldData, draftParsed);

    const finalBody = scaffoldBody.replace(marker, draftBody);
    const yamlText = yaml.dump(mergedData, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });
    const yamlFixed = yamlText.replace(/^date:\s*'([^']*)'\s*$/m, 'date: $1');
    const finalOut = `---\n${yamlFixed}---\n${finalBody}`;

    // 5) 写入 post
    fs.writeFileSync(postPath, finalOut, 'utf8');

    // 6) 迁移 draft 的资源文件夹（如果存在）
    if (useAssetFolder && isDir(draftAssetDir)) {
      moveDirMerge(draftAssetDir, postAssetDir);
    }

    // 7) 删除 draft md（并尽量清理空目录）
    fs.unlinkSync(draftPath);

    // 如果 draft 是 nested：_drafts/name/name.md，顺手清理 _drafts/name（若空）
    const draftParent = path.dirname(draftPath);
    const draftRoot = path.join(sourceDir, draftDir);
    if (draftParent !== draftRoot) {
      try {
        if (fs.readdirSync(draftParent).length === 0) fs.rmdirSync(draftParent);
      } catch {}
    }

    hexo.log.info(`Published: ${postPath}`);
    if (useAssetFolder) hexo.log.info(`Assets:   ${postAssetDir}`);
  }
);
