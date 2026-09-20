'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

hexo.extend.console.register(
  'trans',
  'Convert PNG and JPG images to WebP format using ImageMagick',
  function (args) {
    const targetPath = args._ && args._[0];
    if (!targetPath) {
      hexo.log.error('Usage: hexo trans <path>');
      hexo.log.info('Example: hexo trans . or hexo trans source/_posts');
      return;
    }

    const resolvedPath = path.isAbsolute(targetPath)
      ? targetPath
      : path.join(hexo.base_dir, targetPath);

    if (!fs.existsSync(resolvedPath)) {
      hexo.log.error(`Path not found: ${resolvedPath}`);
      return;
    }

    let convertedCount = 0;
    let errorCount = 0;

    walkDir(resolvedPath, (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        const outputPath = filePath.slice(0, -ext.length) + '.webp';

        try {
          hexo.log.info(`Converting: ${filePath}`);
          execSync(`magick convert "${filePath}" "${outputPath}"`, { stdio: 'pipe' });
          hexo.log.info(`✓ Converted to: ${outputPath}`);
          convertedCount++;
        } catch (error) {
          hexo.log.error(`✗ Failed to convert ${filePath}: ${error.message}`);
          errorCount++;
        }
      }
    });

    hexo.log.info(`\nConversion complete: ${convertedCount} images converted, ${errorCount} errors`);
  }
);
