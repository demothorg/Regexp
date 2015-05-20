(function () {
"use strict";
function pushUnique(arr, item) {
    if (arr.indexOf(item) >= 0)
        return false;
    arr.push(item);
    return true;
}

function pushUniqueArray(arr, array) {
    for (var i=0; i < array.length; i++) {
        if (array.hasOwnProperty(i))
            pushUnique(arr, array[i]);
    }
    return arr;
}

  // TODO: fix function
function prepare(t, parent) {
    t.parent = parent;
    switch (t.type) {
        case "atom":
            if (t.value != "$")
                // indexes.push(t);
            break;

        case "&":
        case "+":
            var val = t.value;
            for (var i = 0; i < val.length; i++) {
                prepare(val[i], t);
            }
            break;
        case "*":
            prepare(t.value, parent);
            break;
    }
}

function getIndexes(t, result) {
    if (!result)
        result = [];

    switch (t.type) {
        case "atom":
            if (t.value != "$") {
                result.push(t);
                result[result.length - 1].index = result.length - 1;
            }
            break;

        case "&":
        case "+":
            var val = t.value;
            for (var i=0; i < val.length; i++) {
                getIndexes(val[i], result);
            }
            break;
        case "*":
            getIndexes(t.value, result);
            break;
    }

    return result;
}


// type in ["firstpos", "lastpos"]
function getpos(t, type, globalResult) {
    if (type != "firstpos" && type != "lastpos")
        throw new Error("Invalid getpos type: " + type);

    if (!globalResult)
        globalResult = [];

    var result = t[type];
    if (result) {
        pushUniqueArray(globalResult, result);
        return result;
    } else
        result = [];

    var val = t.value;
    if (!val)
        return result;
    var len = val.length;

    switch (t.type) {
        case "atom":
            if (t.value != "$")
                pushUnique(result, t);
            break;
        case "*":
            getpos(val, type, result);
            break;
        case "+":
            for (var i=0; i < val.length; i++)
                getpos(val[i], type, result);
            break;
        case "&":
            if (type == "firstpos") {
                for (var i = 0; i < len; i++) {
                    getpos(val[i], type, result);
                    if (val[i].nullable === undefined)
                        val[i].nullable = val[i].canBeEmpty();
                    if (!val[i].nullable)
                        break;
                }
            } else {
                for (var i = len-1; i >= 0; i--) {
                    getpos(val[i], type, result);
                    if (val[i].nullable === undefined)
                        val[i].nullable = val[i].canBeEmpty();
                    if (!val[i].nullable)
                        break;
                }
            }

            break;
    }

    t[type] = result;
    pushUniqueArray(globalResult, result);
    return result;
}

function firstpos(t) {
    return getpos(t, "firstpos");
}
function lastpos(t) {
    return getpos(t, "lastpos");
}
function followpos(t) {
    var val = t.value;
    if (!val)
        return;
    var len = val.length;

    switch (t.type) {
        case "atom":
            if (!t.followpos)
                t.followpos = [];
            break;
        case "*":
            var lp = lastpos(val);
            var fp = firstpos(val);
            for (var i=0; i < lp.length; i++) {
                if (!lp[i].followpos)
                    lp[i].followpos = [];
                pushUniqueArray(lp[i].followpos, fp);
            }
            followpos(val);
            break;

        case "+":
            for (var i=0; i < val.length; i++)
                followpos(val[i]);
            break;

        case "&":
            for (var i=0; i < len-1; i++) {
                var lp = lastpos(val[i]);
                for (var pos=0; pos < lp.length; pos++) {
                    if (!lp[pos].followpos)
                        lp[pos].followpos = [];
                    for (var j = i+1; j < len; j++) {
                        pushUniqueArray(lp[pos].followpos, firstpos(val[j]));
                        if (val[j].nullable === undefined)
                            val[j].nullable = val[j].canBeEmpty();
                        if (!val[j].nullable)
                            break;
                    }
                }
            }

            var lp = lastpos(val[0]);
            var fp = firstpos(val[1]);
            for (var i=0; i < lp.length; i++) {
                if (!lp[i].followpos)
                    lp[i].followpos = [];
                pushUniqueArray(lp[i].followpos, fp);
            }

            for (var i=0; i < val.length; i++)
                followpos(val[i]);
            break;
        default:
            break;
    }
}

function printFollowpos(t) {
    var indexes = getIndexes(t);

    var s = "";
    for (var i=0; i < indexes.length; i++) {
      var f = indexes[i].followpos;
      s += indexes[i].value + "_" + (i+1) + " = {";
      for (var p=0; p < f.length; p++)
        s += (1+indexes.indexOf(f[p])) + ",";
      s += "}\n";
      s = s.replace(",}", "}");
    }

    console.log(s);
}

function genStateName(state) {
    var result = [];
    for (var i=0; i < state.length; i++)
        result.push(state[i].index);
    result = result.sort().toString();
    return result;
}

function createDFA(tree) {
    var t = new Tree(tree);
    var tmp = new Tree("a");
    tmp.value = "#";
    t.doOperation("&", tmp, true);

    followpos(t);
    //printFollowpos(t);

    var indexes = getIndexes(t), states = {}, edges = [], tocheck = [];
    var alphabet = t.getAlphabet();

    tmp = firstpos(t);

    var state = { name: genStateName(tmp), value: tmp };
    var start = state;

    tocheck.push(state);
    states[state.name] = state;

    while (state = tocheck.pop()) {
        var s = state.value;
        for (var i=0; i < alphabet.length; i++) {
            var a = alphabet.charAt(i);
            tmp = [];
            for (var pos=0; pos < s.length; pos++) {
                if (s[pos].value == a)
                    pushUniqueArray(tmp, s[pos].followpos);
            }
            if (tmp.length === 0)
                continue;
            var name = genStateName(tmp);
            if (!states[name]) {
                var newState = states[name] = { name: name, value: tmp };
                tocheck.push(newState);
            }

            edges.push({source: state.name, target: name, label: a});
        }
    }

    var resultNames = [];
    var finIndex = indexes[indexes.length - 1];
    var stateIndex = 0;

    var automata = new Automata();
    automata.create();
    for (var i in states) {
        var s = states[i];
        var name = stateIndex + "";
        if (s.value.indexOf(finIndex) >= 0)
            name += "^";
        if (s == start)
            name = "^" + name;
        resultNames[i] = name;
        automata.makeNode(name);
        stateIndex++;
    }

    for (var i=0; i < edges.length; i++) {
        var e = edges[i];
        e.source = resultNames[e.source];
        e.target = resultNames[e.target];
        automata.addEdge(e.source, e.target, e.label);
    }
    automata.setAlphabet(tree.getAlphabet());

    return automata;
}

// a is generated automata. NOT USER AUTOMATA
function completeDFA(automata) {
    var nodesInfo = {};
    var edges = automata.edges;
    var nodes = automata.nodes;
    var last;

    // Подготавливаем nodesInfo и заодно вычисляем имя новой вершины
    var hasStart = false, hasFinish = false;
    for (var i in nodes) {
        if (nodes[i].isStart)
            hasStart = true;
        if (nodes[i].isFinish)
            hasFinish = true;
        nodesInfo[nodes[i].name] = {
            from: [],
            to: {} // hash table: to[label] = node (only one node, because DFA)
        };

        var k = parseInt(i);
        if (isNaN(k))
            continue;
        if (last == undefined)
            last = k;
        else if (k > last)
            last = k;
    }

    if (!hasStart && hasFinish)
        throw new Error("Invalid automata! There is no finish or start node");
    else if (!hasStart && !hasFinish) {
        nodesInfo["0"] = {from: [], to: {}};
        automata.makeNode("^0");
    }

    if (last == undefined)
        last = 0; // автомат пустой, а значит мы добавили выше нулевую вершину

    last = parseInt(last)+1;
    var newNode = last+"";


    if (isNaN(last) || nodes[newNode])
        throw new Error("Invalid automata! Use only generated automata");

    // Формируем nodesInfo и проверяем, что автомат является DFA
    var alphabet = automata.getAlphabet();
    for (var i=0; i < edges.length; i++) {
        var from = edges[i].source, to = edges[i].target;
        var label = edges[i].label;
        if (label == "$" || nodesInfo[from].to[label])
            throw new Error("Automata is not DFA");

        nodesInfo[from].to[label] = to;
        nodesInfo[to].from.push(from);
    }

    // Всё хорошо и nodesInfo сформирован, можно портить автомат
    // Здесь мы уже портим исходный автомат. nodes и edges изменяются неявно
    for (var i in nodesInfo) {
        var node = nodesInfo[i];
        for (var j=0; j < alphabet.length; j++) {
            var a = alphabet.charAt(j);
            if (node.to[a])
                continue;
            node.to[a] = newNode;
            automata.addEdge(i, newNode, a);

            if (!nodesInfo[newNode])
                nodesInfo[newNode] = { from: [], to: {} };
            nodesInfo[newNode].from.push(i);
        }
    }

    // Если newNode пригодилась, значит надо добавить в неё связи
    if (nodes[newNode]) {
        for (var i=0; i < alphabet.length; i++) {
            var a = alphabet.charAt(i);
            automata.addEdge(newNode, newNode, a);
            nodesInfo[newNode].to[a] = newNode;
        }
    }
    automata.setAlphabet(alphabet);
    return {
        nodesInfo: nodesInfo,
        alphabet: alphabet
    };
}

function minDFA(automata) {
    var groups = [[], []];
    var info = completeDFA(automata);
    var alphabet = info.alphabet;
    var nodesInfo = info.nodesInfo;
    var nodes = automata.nodes;

    // Делаем первоначальное разбиение на две группы (конечные и не конечные)
    for (var i in nodes) {
        var node = nodes[i];
        var index = node.isFinish+0;
        groups[index].push(node);

        // портим оригинальные объекты для удобства, потом почистим
        node["@index"] = index;
    }

    // Измельчаем группы, пока можем
    var newGroups = null;
    do {
        if (newGroups)
            groups = newGroups;
        newGroups = [];

        var temp = {};
        for (var i=0; i < groups.length; i++) {
            for (var j=0; j < groups[i].length; j++) {
                var node = groups[i][j];

                // вычисляем уникальный id для группы
                var id = i + "";
                for (var alpha=0; alpha < alphabet.length; alpha++) {
                    var a = alphabet.charAt(alpha);
                    id += "_" + nodes[nodesInfo[node.name].to[a]]["@index"];
                }

                if (!temp[id])
                    temp[id] = [node];
                else
                    temp[id].push(node);
            }
        }

        // обновляем индексы
        var index = 0;
        for (var i in temp) {
            newGroups.push(temp[i]);
            for (var j=0; j < temp[i].length; j++)
                temp[i][j]["@index"] = index;
            index++;
        }
    } while (newGroups.length != groups.length);

    // Создаем новый, уменьшенный, автомат
    var newAuto = new Automata();
    newAuto.create();

    var startGroup;
    for (var i in nodes) {
        if (!nodes[i].isStart)
            continue;
        startGroup = nodes[i]["@index"];
        break;
    }

    for (var i=0; i < groups.length; i++) {
        var node = groups[i][0];
        var name = "";
        if (i == startGroup)
            name += "^";
        name += i;
        if (node.isFinish)
            name += "^";
        newAuto.makeNode(name);
        for (var alpha=0; alpha < alphabet.length; alpha++) {
            var a = alphabet.charAt(alpha);
            newAuto.addEdge(name, nodes[nodesInfo[node.name].to[a]]["@index"], a);
        }
    }

    // удаляем вспомогательные индексы
    for (var i in nodes)
        delete nodes[i]["@index"];
    newAuto.setAlphabet(automata.getAlphabet());

    return newAuto;
}

function complement (automata) {
    //var info = 
    completeDFA(automata);
    var nodes = automata.nodes;
    for (var i in nodes)
        nodes[i].isFinish = !nodes[i].isFinish;
    return automata;
}

window.TestDFA = function (s) {
    var dfa1 = DFA(new Tree(s));
    var s1 = dfa1.toTree()+"";

    var dfa2 = DFA(new Tree(s1));
    var s2 = dfa2.toTree()+"";

    if (s1 != s2)
        return "Alarm: \n" + s1 + "!=" + s2 + "\n";
};

window.DFA = function (tree) {
    if (typeof(tree) == "string")
        tree = new Tree(tree);
    var dfa = createDFA(tree);
    dfa = minDFA(dfa);
    return dfa;
};

window.inter = function (a, b, alphabet) {
    if (typeof(a) == "string")
        a = new Tree(a);
    if (typeof(b) == "string")
        b = new Tree(b);
    if (!alphabet)
        alphabet = "";

    a.setAlphabet(alphabet);
    b.setAlphabet(alphabet);
    b.setAlphabet(a.getAlphabet());
    a.setAlphabet(b.getAlphabet());

    var dfaA = complement(DFA(a));
    var dfaB = complement(DFA(b));
    var t = dfaA.toTree(0);
    t.doOperation("+", dfaB.toTree(0));
    return complement(DFA(t)).toTree();
};

window.subtr = function (a, b, alphabet) {
    if (typeof(a) == "string")
        a = new Tree(a);
    if (typeof(b) == "string")
        b = new Tree(b);
    if (!alphabet)
        alphabet = "";

    a.setAlphabet(alphabet);
    b.setAlphabet(alphabet);
    b.setAlphabet(a.getAlphabet());
    a.setAlphabet(b.getAlphabet());

    return inter(a, complement(DFA(b)).toTree());
};

window.complement = function (a, alphabet) {
    if (typeof(a) == "string")
        a = new Tree(a);
    if (!alphabet)
        alphabet = "";
    a.setAlphabet(alphabet);
    return complement(DFA(a)).toTree();
};

window.equal = function (a, b) {
    // slow but good
    return subtr(a, b) == "" && subtr(b, a) == "";
    //return DFA(a).toTree()+"" == DFA(b).toTree()+"";
};

;})();