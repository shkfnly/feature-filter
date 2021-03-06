'use strict';

var VectorTileFeatureTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];


function infix(operator) {
    return function(_, key, value) {
        if (key === '$type') {
            return 't' + operator + VectorTileFeatureTypes.indexOf(value);
        } else {
            if (Array.isArray(key)){
                return nestedFilterHelper(operator, key, value)
            } else {
            return 'p[' + JSON.stringify(key) + ']' + operator + JSON.stringify(value);
            }
        }
    };
}

function strictInfix(operator) {
    var nonstrictInfix = infix(operator);
    return function(_, key, value) {
        if (key === '$type') {
            return nonstrictInfix(_, key, value);
        } else {
            return 'typeof(p[' + JSON.stringify(key) + ']) === typeof(' + JSON.stringify(value) + ') && ' +
                nonstrictInfix(_, key, value);
        }
    };
}

var operators = {
    '==': infix('==='),
    '!=': infix('!=='),
    '>': strictInfix('>'),
    '<': strictInfix('<'),
    '<=': strictInfix('<='),
    '>=': strictInfix('>='),
    'in': function(_, key) {
        return Array.prototype.slice.call(arguments, 2).map(function(value) {
            return '(' + operators['=='](_, key, value) + ')';
        }).join('||') || 'false';
    },
    '!in': function() {
        return '!(' + operators.in.apply(this, arguments) + ')';
    },
    'any': function() {
        return Array.prototype.slice.call(arguments, 1).map(function(filter) {
            return '(' + compile(filter) + ')';
        }).join('||') || 'false';
    },
    'all': function() {
        return Array.prototype.slice.call(arguments, 1).map(function(filter) {
            return '(' + compile(filter) + ')';
        }).join('&&') || 'true';
    },
    'none': function() {
        return '!(' + operators.any.apply(this, arguments) + ')';
    }
};

function nestedFilterHelper(operator, key, value){
    var string = '('
    var fullPath = ''
    var i = 0;
    while (i < key.length){
        var j = 0;
        var tempString = ''
        while (j <= i){
            tempString += '[' + JSON.stringify(key[j]) + ']'
            j++;
        }
        i === key.length-1 ? (string += ('p' + tempString), fullPath = tempString) : string += ('p' + tempString + ' && ');
        i++;
    }    
    return string +') ? (p' + fullPath + operator + JSON.stringify(value) + ') : false';
}

function compile(filter) {
    return operators[filter[0]].apply(filter, filter);
}

function truth() {
    return true;
}

/**
 * Given a filter expressed as nested arrays, return a new function
 * that evaluates whether a given feature (with a .properties or .tags property)
 * passes its test.
 *
 * @param {Array} filter mapbox gl filter
 * @returns {Function} filter-evaluating function
 */
module.exports = function (filter) {
    if (!filter) return truth;
    var filterStr = 'var p = f.properties || (f.properties && f.properties.tags) || {}, t = f.type; return ' + compile(filter) + ';';
    // jshint evil: true
    return new Function('f', filterStr);
};
