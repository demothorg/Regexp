;(function () {
"use strict";    

var size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key))
            size++;
    }
    return size;
};

function removeSimpleNodes(nodesInfo) {
    var deleted = [];
    for (var i in nodesInfo) {
        var n = nodesInfo[i];
        var k = 0; //n.to[i] ? 1 : 0;
        if (size(n.to)-k != 1 || size(n.from)-k != 1)
            continue;

        var from, to, fromLabel, toLabel;
        for (var j in n.from) {
            if (i == j)
                continue;
            from = j;
            fromLabel = n.from[j]
            break;
        }
        for (var j in n.to) {
            if (i == j)
                continue;
            to = j;
            toLabel = n.to[j];
            break;
        }
        
        if (k > 0)
            fromLabel.doOperation("&", n.to[i].doOperation("*"));
        
        var label = fromLabel.doOperation("&", toLabel);
        if (nodesInfo[to].from[from]) {
            nodesInfo[from].to[to] =
            nodesInfo[to].from[from].doOperation("+", label);
        } else {
            nodesInfo[from].to[to] =
            nodesInfo[to].from[from] = label;
        }
        delete nodesInfo[from].to[i];
        delete nodesInfo[to].from[i];
        
        deleted.push(i);
    }
    
    for (var i = 0; i < deleted.length; i++)
        delete nodesInfo[deleted[i]];
    //console.log("Removed " + deleted.length + " nodes");
}

function eleminateNode(nodesInfo, name) {
    var n = nodesInfo[name];
    if (size(n.from) == 0 || size(n.to) == 0)
        return;
    
    var loopLabel;
    if (n.to[name])
        loopLabel = (new Tree(n.to[name], 3)).doOperation("*");
    for (var from in n.from) {
        if (from == name)
            continue;
        var labelFrom = new Tree(n.from[from], 3);
        if (loopLabel)
            labelFrom.doOperation("&", loopLabel);
        for (var to in n.to) {
            if (to == name)
                continue;
            var label = new Tree(labelFrom, 3);
            label.doOperation("&", new Tree(n.to[to], 3));
            if (nodesInfo[from].to[to])
                label.doOperation("+", nodesInfo[from].to[to]);
            nodesInfo[from].to[to] =
            nodesInfo[to].from[from] = label;
        }
    }
    for (var from in n.from)
        delete nodesInfo[from].to[name];
    for (var to in n.to)
        delete nodesInfo[to].from[name];
    delete nodesInfo[name];
}

function convert(nodesInfo, nodes, order) {
    var temp = {};
    for (var node in nodesInfo) {
        temp[node] = {from: {}, to: {}};
        for (var i in nodesInfo[node].from)
            temp[node].from[i] = new Tree(nodesInfo[node].from[i]);
        for (var i in nodesInfo[node].to)
            temp[node].to[i] = new Tree(nodesInfo[node].to[i]);
    }
    nodesInfo = temp;
    if (typeof(order) == "object") {
        for (var index = 0; index < order.length; index++)
            eleminateNode(nodesInfo, order[index]);
    } else {
        nodes = nodes.concat();
        while (nodes.length > 0) {
            var name = nodes.splice(order % nodes.length, 1)[0];
            order = Math.floor(order / nodes.length);
            eleminateNode(nodesInfo, name);
        }
    }
            
    return nodesInfo["#start"].to["#finish"];
}

var Automata = function (value) {
    this.alphabet = "";
    this.edges =
    this.nodes =
    this.start = null; // for future. Need API: graphToEdges, edgesToGraph
    if (typeof(value) == "string")
        this.fromText(value);
    else if (typeof(value) == "object")
        throw new Error("Temporary unsupport"); //this.edges = value;
};

Automata.prototype.labelRegEx = /^[a-z0-9$]$/;

Automata.prototype.checkEdges = function () {
    if (this.edges != null)
        return this.edges;
    throw new Error("Automata has no edges");
};
Automata.prototype.toString = function () {
    var edges = this.checkEdges();
    //this.getUsedNodes(); // remove unused edges
    var result = "";
    for (var i in this.nodes) {
        var node = this.nodes[i];
        if (typeof(node) != "object" || typeof(node.isStart) != "boolean")
            continue;

    }

    for (var i in this.nodes) {
        var node = this.nodes[i];
        if (!node.isStart && !node.isFinish)
            continue;
        if (node.isStart)
            result += "^";
        result += node.name;
        if (node.isFinish)
            result += "^";
        result += "\n";
    }

    for (var i=0; i < edges.length; i++) {
        var edge = edges[i];
        var src = edge.source+"";
        var tar = edge.target+"";

        result += src + ", " + tar;
        if (edge.label && edge.label != "$")
            result += ", " + edge.label.toString();
        result += "\n";
    }

    result = result.substring(0, result.length-1);
    return result;
};

Automata.prototype.getUsedNodes = function() {
    var edges = this.checkEdges();
    var nodesInfo = this.nodes;
    if (edges == null)
        throw new Error("Automata has no edges");
    function fillUsedNodes(nodes, name) {
        if (name) {
            nodes.push(name);
            for (var i=0; i < edges.length; i++) {
                if (edges[i].source == name && nodes.indexOf(edges[i].target) < 0)
                    fillUsedNodes(nodes, edges[i].target);
            }
        } else {
            for (var i in nodesInfo) {
                if (nodesInfo[i].isStart && nodes.indexOf(i) < 0)
                    fillUsedNodes(nodes, i);
            }
        }
    }
    function reachesFinish(name, tempNodes) {
        if (!tempNodes)
            tempNodes = [];
        if (nodesInfo[name].isFinish)
            return true;
        tempNodes.push(name);
        for (var i=0; i < edges.length; i++) {
            if (edges[i].source != name)
                continue;
            else if (tempNodes.indexOf(edges[i].target) < 0) {
                if (reachesFinish(edges[i].target, tempNodes))
                    return true;
                else
                    tempNodes.push(edges[i].target);
            }
        }
        return false;
    }

    var nodes = [], usedNodes = [];
    fillUsedNodes(nodes);
    for (var i = 0; i < nodes.length; ++i) {
        if (reachesFinish(nodes[i]))
            usedNodes.push(nodes[i]);
    }

    // remove unused edges
    for (var i = edges.length-1; i >= 0 ; --i) {
        if (usedNodes.indexOf(edges[i].source) < 0 ||
            usedNodes.indexOf(edges[i].target) < 0)
            edges.splice(i, 1);
    }
    return usedNodes;
};

Automata.prototype.getAlphabet = function () {
    if (this.alphabet)
        return this.alphabet;

    var a = "";
    for (var i=0; i < this.edges.length; i++) {
        var ch = this.edges[i].label;
        if (ch != "$" && a.indexOf(ch) < 0)
            a += ch;
    }

    this.alphabet = a;
    return a;
};

Automata.prototype.setAlphabet = function (alphabet) {
    var a = this.getAlphabet();
    for (var i=0; i < alphabet.length; i++) {
        if (a.indexOf(alphabet.charAt(i)) < 0)
            a += alphabet.charAt(i);
    }
    this.alphabet = a;
};

Automata.prototype.prepare = function (nodes, edges) {
    // convert char labels to trees
    for (var i=0; i < edges.length; i++) {
        edges[i] = {source: edges[i].source, target: edges[i].target, label: edges[i].label};
        edges[i].label = new Tree(edges[i].label);
    }

    // prepare automata
    var startNodes = [], finishNodes = [];
    for (var i=0; i < nodes.length; i++) {
        if (this.nodes[nodes[i]].isStart)
            startNodes.push(nodes[i]);
        if (this.nodes[nodes[i]].isFinish)
            finishNodes.push(nodes[i]);
    }
    if (startNodes.length == 0 || finishNodes.length == 0)
        return {};

    for (var i=0; i < startNodes.length; i++)
        edges.push({source: "#start", target: startNodes[i], label: new Tree("$")});
    for (var i=0; i < finishNodes.length; i++)
        edges.push({source: finishNodes[i], target: "#finish", label: new Tree("$")});

    ////////////////////////////
    var nodesInfo = {};
    nodes.push("#start");
    nodes.push("#finish")
    for (var i=0; i < nodes.length; i++) {
        nodesInfo[nodes[i]] = {
            from: {},
            to: {}
        };
    }
    for (var i=0; i < edges.length; i++) {
        var from = edges[i].source, to = edges[i].target;
        var label = new Tree(edges[i].label);
        
        if (nodesInfo[from].to[to]) { // достаточно изменить одну метку, т.к. они связаны
            nodesInfo[from].to[to].doOperation("+", label);
        } else {
            nodesInfo[from].to[to] = label;
            nodesInfo[to].from[from] = label;
        }
    }
    
    removeSimpleNodes(nodesInfo);
    nodes.splice(0);
    for (var i in nodesInfo)
        nodes.push(i);
    nodes.splice(nodes.indexOf("#start"), 1);
    nodes.splice(nodes.indexOf("#finish"), 1);
    
    return nodesInfo;
};

Automata.prototype.analyze = function () {
    var nodes = this.getUsedNodes();
    var edges = this.edges.concat();
    var nodesInfo = this.prepare(nodes, edges);
    var result = "";
    var way = [], ways = {};
    
    var checkWay = function (node) {
        var start = way.indexOf(node);
        if (start < 0) {                    
            way.push(node);
            for (var i in nodesInfo[node].to)
                checkWay(i);
            start = 0;
        } else
            way.push(node);

        var wayStr = way[start];
        var wayReg = "";
        for (var i = start+1; i < way.length; i++) {
            var label = nodesInfo[way[i-1]].to[way[i]] + "";
            if (label != "$") {
                //result += " -> {" + label + "}";
                wayReg += label;
            }
            wayStr += " -> " + way[i];
        }
        if (wayReg == "")
            wayReg = "$";
        
        if (start == 0 && node != "#finish") {
            way.pop();
            return;
        } else {
            if (ways[way[start]] == undefined)
                ways[way[start]] = [];
            ways[way[start]].push(way.slice(start));
            way.pop();
        }
        
        result += wayStr;
        var align = 15;
        for (var i = 0; i < align - wayStr.length % align; i++)
            result += ".";
        result += " " + wayReg;
        
        if (way.length > 0)
            result += "\n";
    };
    
    var makeTree = function (node) {
        if (way.indexOf(node) >= 0)
            return null;
        var ww = ways[node];
        if (ww.length === undefined)
            return ww;
        way.push(node);
        var t = new Tree();
        for (var i = 0; i < ww.length; i++) {
            var w = ww[i];
            var t1 = new Tree("$");
            for (var j = 1; j < w.length; j++) {
                t1.doOperation("&", new Tree(nodesInfo[w[j-1]].to[w[j]], 2));
                if (j+1 >= w.length || !ways[w[j]])
                    continue;
                var t2 = makeTree(w[j]);
                if (!t2)
                    return null;
                t1.doOperation("&", new Tree(t2.doOperation("*"), 2));
            }
            
            t.doOperation("+", t1);
        }
        way.pop();
        ways[node] = t;
        return t;
    };
    
    checkWay("#start");
    //console.log(result);
    var t = makeTree("#start");
    //console.log(t+"");
};

Automata.prototype.toTree = function(level, callback, needDbg) {
    //if (!callback)
    //    callback = function (tree) { return tree.normalize().optimize(); };
        
    var nodes = this.getUsedNodes();
    var edges = this.edges.concat();
    var nodesInfo = this.prepare(nodes, edges);
    if (!nodesInfo["#start"]) {
        var result = new Tree();
        result.setAlphabet(this.getAlphabet());
        return result;
    }

    if (level === undefined)
        level = 2;

    // vars for both methods
    var minTree, minSize=1/0, minSH=1/0, minLen=1/0;
    var bestOrder = nodes.concat();
    var total = 0;
    var compare = function (order) {
        total++;
        var tree = convert(nodesInfo, nodes, order);
        if (callback)
            tree = callback(tree);
        var sh = tree.getStarHeight();
        if (sh > minSH)
            return 0;
        var size = tree.getSize();
        if (sh == minSH && size >= minSize)
            return size == minSize ? 0 : -1;
        //var len = tree.getLength();
        //if (sh == minSH && size == minSize && len >= minLen)
        //    return false;
        minTree = tree;
        minSH = sh;
        minSize = size;
        //minLen = len;
        bestOrder = typeof(order) == "object" ? order.concat() : order;
        return 1;
    }
    
    var debug = nodes.length + " nodes, level " + level + ", ";
    if (level == 0) {
        compare(nodes);
    } else if (nodes.length <= 4 || level >= 4 && nodes.length <= 7) {
        var factorial = function(n) {
            if (n <= 1)
                return 1;
            return n * factorial(n - 1);
        }
        var minOrder;
        var maxCount = factorial(nodes.length);
        for (var i = 0; i < maxCount; i++) {
            if (compare(i) > 0)
                minOrder = i;
        }
        
        debug += "Method: full, Total = " + maxCount;
    } else {
        var swap = function(i, j) {
            var temp = order[i];
            order[i] = order[j];
            order[j] = temp;
        }

        // compute auxiliary limit
        var n = nodes.length;
        var limit = 3000;
        var k = n*n - n*(n-1)/2;
        if (k > limit)
            k = limit;
        var d = (2*n-1)*(2*n-1) + 8*(n-k);
        var m = Math.floor(n - 1/2 - Math.sqrt(d)/2);
        if (m <= 0) {
            m = 1;
            if (n > limit)
                n = limit;
        }
        
        // o(k(n-1)(n+2)/2), k >= 1

        var changed, best;
        var order = nodes.concat();
        compare(order);
        
        // clever brute algorithm
        var swapInfo = {};
        var trySwap = function (i, j) {
            if (i == j)
                return false;
            
            var nodeA = order[i], nodeB = order[j];
            var swapId = [nodeA, nodeB].sort().toString();
            if (swapInfo[swapId] !== undefined)// && swapInfo[swapId] != nodeA)
                return false;
            
            order[i] = nodeB;
            order[j] = nodeA;
            var result = compare(order);
            
            if (result < 0)
                swapInfo[swapId] = nodeB;
            
            if (result <= 0) {
                order[i] = nodeA;
                order[j] = nodeB;
                return false;                
            }
            
            swapInfo[swapId] = nodeA;
            return true;
        }
        
        //for (var i = 0; i < m; i++) {
        //    for (var j = i; j < n; j++)
        //        changed = trySwap(i, j);
        //}
                
        // simple brute algorithm
        //if (false)
        do {
            changed = false;
            for (var i = 0; i < m; i++) {
                best = -1;
                for (var j = i; j < n; j++) {
                    //total++;
                    swap(i, j);
                    if (compare(order) > 0 && i != j)
                        best = j;
                    swap(i, j);                    
                }
                if (best >= 0) {
                    swap(i, best);
                    changed = true;
                }
            }
            //if (changed)
            //    console.log("Loal!");
            if (level == 1)
                break;
        } while (changed);
        
        debug += "Method: heur, Total = " + total;
    }
    
    //console.log(nodes.length, total);
    //console.log(debug);
    minTree = new Tree(minTree);
    minTree.setAlphabet(this.getAlphabet());
    return minTree;//.normalize();
};

// Use this function before creating automata
Automata.prototype.create = function () {
    this.alphabet = "";
    this.edges = [];
    this.nodes = {};
    this.start = null;
    for (var i=0; i < arguments.length; i++)
        this.makeNode(arguments[i]);
};

Automata.prototype.addEdge = function (source, target, label) {
    if (!label)
        label = "$";
    if (!this.labelRegEx.test(label))
        throw new Error("Invalid label '" + label + "'");
    if (this.edges == null) {
        this.edges = [];
        this.nodes = {};
    }
    source = this.makeNode(source).name;
    target = this.makeNode(target).name;
    this.alphabet = "";

    this.start = null;
    var edge, edges = this.edges;
    for (var i=0; i < edges.length; i++) {
        var e = edges[i];

        if (e.source == source && e.target == target && 
            e.label == label) {
            edge = e;
            break;
        }
    }

    if (!edge)
        edges.push({source: source, target: target, label: label});
};

Automata.prototype.makeNode = function (name) {
    if (typeof(name) != "string")
        name = name.toString();

    name = name.toLowerCase();
    var isStart, isFinish;
    isStart = name.charAt(0) == "^";
    isFinish = name.charAt(name.length-1) == "^";
    if (name.replace("^", "").length == 0)
        throw new Error("Invalid node name");
    if (isStart)
        name = name.substr(1);
    if (isFinish)
        name = name.substring(0, name.length - 1);
    if (name.indexOf("^") >= 0)
        throw new Error("Invalid node name");
    var node = {
        name: name,
        isStart: isStart,
        isFinish: isFinish};

    var oldNode = this.nodes[node.name];
    if (oldNode) {
        if (!isStart && !isFinish ||
            oldNode.isStart == isStart && oldNode.isFinish == isFinish)
            return oldNode;
        else if (oldNode.isStart || oldNode.isFinish)
            throw new Error("Declaration conflict");
    }

    this.nodes[node.name] = node;

    return node;
};

Automata.prototype.fromText = function(text) {
    text = text.replace(/[ \t\r]/g, "");
    var lines = text.split("\n");
    this.edges = [];
    this.nodes = {};
    for (var i=0; i < lines.length; i++) {
        var args = lines[i].split("#")[0].split(",");
        if (args.length == 0)
            continue;
        else if (args.length < 2) {
            if (args[0] != "")
                this.makeNode(args[0]);
            continue;
        }

        this.addEdge(args[0], args[1], args[2]);
    }
    return this;
};

window.Automata = Automata;

})();