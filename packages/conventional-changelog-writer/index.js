'use strict';
var compareFunc = require('compare-func');
var dateFormat = require('dateformat');
var fs = require('fs');
var semver = require('semver');
var through = require('through2');
var util = require('./lib/util');
var _ = require('lodash');

function conventionalcommitsWriter(version, context, options) {
  if (!version) {
    throw new TypeError('Expected a version number');
  }

  var commits = [];
  var notes = [];
  var host = context && context.host;
  var isPatch = semver.patch(version) !== 0;

  context = _.extend({
    version: version,
    title: '',
    isPatch: isPatch,
    commit: 'commits',
    issue: 'issues',
    date: dateFormat(new Date(), 'yyyy-mm-dd', true)
  }, context);

  if (host && context.repository && context.commit && context.issue) {
    context.linkReferences = context.linkReferences || true;
  }

  if (host && host[host.length - 1] === '/') {
    context.host = host.slice(0, -1);
  }

  options = _.extend({
    transform: {
      hash: function(hash) {
        return hash.substring(0, 7);
      },
      subject: function(subject) {
        return subject.substring(0, 80);
      },
      type: function(type) {
        if (type === 'fix') {
          return 'Bug Fixes';
        } else if (type === 'feat') {
          return 'Features';
        } else if (type === 'perf') {
          return 'Performance Improvements';
        }
      }
    },
    groupBy: 'type',
    noteGroups: {
      'BREAKING CHANGE': 'BREAKING CHANGES'
    },
    commitGroupsSort: 'title',
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: compareFunc(),
    mainTemplate: fs.readFileSync(__dirname + '/templates/template.hbs', 'utf-8'),
    headerPartial: fs.readFileSync(__dirname + '/templates/header.hbs', 'utf-8'),
    commitPartial: fs.readFileSync(__dirname + '/templates/commit.hbs', 'utf-8'),
    footerPartial: fs.readFileSync(__dirname + '/templates/footer.hbs', 'utf-8')
  }, options);

  options.commitGroupsSort = util.functionify(options.commitGroupsSort);
  options.commitsSort = util.functionify(options.commitsSort);
  options.noteGroupsSort = util.functionify(options.noteGroupsSort);
  options.notesSort = util.functionify(options.notesSort);

  return through.obj(function(chunk, enc, cb) {
    var commit = util.processCommit(chunk, options.transform);

    commits.push(commit);
    notes = notes.concat(commit.notes);

    cb();
  }, function(cb) {
    var compiled = util.compileTemplates(options);

    context = _.merge(context, util.getExtraContext(commits, notes, options));

    this.push(compiled(context));
    cb();
  });
}

module.exports = conventionalcommitsWriter;