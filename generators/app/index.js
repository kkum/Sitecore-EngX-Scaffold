'use strict';
const chalk = require('chalk');
const Generator = require('yeoman-generator-asmagin');
const yosay = require('yosay');
const getRandomValues = require('get-random-values');

const utils = require('../../lib/utils.js');

const msg = require('../../config/messages.json');
const versions = require('../../config/versions.json');
const replacements = require('../../config/replacements.json');

module.exports = class HelixGenerator extends Generator {
  constructor(args, opts) {
    // Calling the super constructor is important so our generator is correctly set up
    super(args, opts);
    this.option('solutionName', {
      type: String,
      required: false,
      desc: 'The name of the solution.',
      default: this.appname,
    });
    this.option('websiteUri', {
      type: String,
      required: false,
      desc: 'The uri of the website.',
      default: this.appname.replace(/[^a-z0-9\-]/gi, '-').toLocaleLowerCase() + '.local',
    });
    this.option('localPath', {
      type: String,
      required: false,
      desc: 'The directory root path of the website.',
      default: 'C:\\Inetpubwwwroot\\' + this.appname.replace(/[^a-z0-9\-]/gi, '-').toLocaleLowerCase() + '.local',
    });
    this.option('sitecoreVersion', {
      type: String,
      required: false,
      desc: 'The version of sitecore to use.',
      default: versions[0].value,
    });
    this.option('sitecoreUpdate', {
      type: String,
      required: false,
      desc: 'The version of sitecore to use.',
      default: versions[0].value[0].value,
    });
  }

  // yeoman events
  initializing() {
    this.log(yosay('Welcome to ' + chalk.red.bold('Sitecore EngX Accelerator') + ' generator!'));

    this.log('');
    this.log(chalk.red.bold('YOU MUST RUN THIS GENERATOR AS AN ADMINISTRATOR.'));
    this.log('');
  }

  prompting() {
    const self = this;

    return self
      .prompt([
        {
          name: 'solutionName',
          message: msg.solutionName.prompt,
          default: self.appname,
        },
        {
          name: 'websiteUri',
          message: msg.websiteUri.prompt,
          default: self.appname.replace(/[^a-z0-9\-]/gi, '-').toLocaleLowerCase() + '.local',
        },
        {
          name: 'localPath',
          message: msg.localPath.prompt,
          default: 'C:\\Inetpub\\wwwroot\\' + self.appname.replace(/[^a-z0-9\-]/gi, '-').toLocaleLowerCase() + '.local',
        },
        {
          type: 'list',
          name: 'sitecoreVersion',
          message: msg.sitecoreVersion.prompt,
          choices: versions,
        },
      ])
      .then(function(answers) {
        self.options = Object.assign({}, self.options, answers);
        return self.prompt([
          {
            type: 'list',
            name: 'sitecoreUpdate',
            message: msg.sitecoreUpdate.prompt,
            choices: self.options.sitecoreVersion.value
              ? self.options.sitecoreVersion.value
              : self.options.sitecoreVersion,
          },
        ]);
      })
      .then(function(answers) {
        self.options = Object.assign({}, self.options, answers);
        // Nuget version update
        self.options.nuget = [
          {
            old: '9.0.171219',
            new: (self.options.sitecoreUpdate.value ? self.options.sitecoreUpdate.value : self.options.sitecoreUpdate)
              .nugetVersion,
          },
        ];

        self.options.vagrantBoxName = (self.options.sitecoreUpdate.value
          ? self.options.sitecoreUpdate.value
          : self.options.sitecoreUpdate
        ).vagrantBoxName;

        self.options.solutionNameUri = self.options.solutionName.replace(/[^a-z0-9\-]/gi, '-');

        self.async();
      });
  }

  writing() {
    const self = this;

    self.options.solutionSettings = JSON.stringify({
      solutionName: self.options.solutionName,
      solutionNameUri: self.options.solutionNameUri,
      websiteUri: self.options.websiteUri,
      localPath: self.options.localPath.replace('\\', '\\\\'),
      solutionNameUri: self.options.solutionNameUri,
      sitecoreVersion: self.options.sitecoreVersion,
      sitecoreUpdate: self.options.sitecoreUpdate,
    });

    // // Rename files
    // this.registerTransformStream(getRenameTransformStream(this.options));

    const globOptions = {
      dot: true,
      sync: true,
      debug: true,
      ignore: [
        // completely ignore
        '**/code/bin/**/*.*',
        '**/code/obj/**/*.*',
        '**/*.user',

        // packages
        '**/src/packages/**/*',
        '**/src/node_modules/**/*',

        // vs
        '**/.vs*/**/*',
      ],
    };

    self.fs.copy(self.templatePath('**/*'), self.destinationPath(), {
      globOptions,
      process: function(content, path) {
        if (typeof content === 'undefined') {
          return;
        }

        if (path.match(/.*\.dll.*/gi)) {
          return content;
        }

        var result = self._replaceTokens(content, self.options);

        self.options.nuget.forEach((id) => {
          result = result.replace(new RegExp(utils.escapeRegExp(id.old), 'g'), id.new);
        });

        replacements[self.options.sitecoreUpdate.name].forEach((pair) => {
          result = result.replace(new RegExp(utils.escapeRegExp(pair.old), 'g'), pair.new);
        });

        // scope to modifications of rainbow YAML fils only
        if (path.match(/.*SolutionRoots.*\.yml/gi) || path.match(/.*serialization\.content.*\.yml/gi)) {
          result = utils.generateHashBasedItemIdsInYamlFile(result, path);
        } else if (path.match(/.*\.yml/gi)) {
          result = utils.generateHashBasedItemIdsInYamlFile(result, path, true);
        }

        // Cannot set VM name if it contains periods
        if (path.match(/.*Vagrantfile/gi)) {
          const hostname = self.options.solutionName.replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
          result = result.replace(new RegExp(utils.escapeRegExp(self.options.solutionName), 'g'), hostname);
        }

        return result;
      },
      processPath: function(path) {
        return self._replaceTokens(path, self.options);
      },
    });
  }

  end() {
    const self = this;

    utils.addCredentialsToWindowsVault(self.options.websiteUri, 'vagrant', 'vagrant').then(() => {
      console.log('');
      console.log('Solution name ' + chalk.green.bold(self.options.solutionName) + ' has been created.');
    });
  }

  _replaceTokens(input, options) {
    if (typeof input === 'undefined') {
      return input;
    }

    var uuidv4 = function() {
      return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^ (getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
    };

    var content = input instanceof Buffer ? input.toString('utf8') : input;

    return content
      .replace(/SolutionSettingsX/g, options.solutionSettings)
      .replace(/SolutionX/g, options.solutionName)
      .replace(/VagrantBoxNameX/g, options.vagrantBoxName)
      .replace(/UuidX/g, uuidv4())
      .replace(/SolutionUriX/g, options.solutionNameUri);
  }
};
