;(function () {
"use strict";

function Tree (arg, deep) {
    if (typeof(arg) == "string") {
        this.parse(arg);
    } else if (typeof(arg) == "object") {
        this.type = arg.type;
        if (deep === 0) {
            this.value = arg.value;
            return;
        }
        
        switch (arg.type) {
            case "*":
                this.value = new Tree(arg.value, deep-1);
                break;
            case "+": case "&":
                this.value = new Array(arg.value.length);
                for (var i = 0; i < arg.value.length; i++)
                    this.value[i] = new Tree(arg.value[i], deep-1);
                //this.value = arg.value.map(function (a) { return new Tree(a); });
                break;
            case "atom":
                this.value = arg.value;
                break;
            case "empty":
                break;
            default:
                throw new Error("invalid tree type '" + arg.type + "'");
                break;
        }
    } else {
        this.type = "empty";
        this.value = undefined;
        this.alphabet = "";
    }

    // types: "*", "+", "&", "atom", "subtree"
    // if type is
    //   "*"        then value is Tree
    //   "+" or "&" then value is Array of Tree
    //   "atom"     then value is "a"zor "$"
    //   "subtree"  then value is offset of regexp stirng
}

Tree.prototype.labelRegEx = /^[a-z0-9$]$/;

// returns count of tree nodes
Tree.prototype.getDeep = function (deep) {
    var tree = this;
    if (deep === undefined)
        deep = 0;
    if (tree.type == "+" || tree.type == "&") {
        var maxDeep = 0;
        for (var i=0; i < tree.value.length; i++) {
            var tmp = tree.value[i].getDeep(deep);
            if (tmp > maxDeep)
                maxDeep = tmp;
        }
        return maxDeep + 1;
    } else if (tree.type == "*")
        return tree.value.getDeep(deep + 1);
    return deep;
};

Tree.prototype.getSize = function () {
    var tree = this;
    var count = 1;
    if (tree.type == "+" || tree.type == "&") {
        for (var i=0; i < tree.value.length; i++)
            count += tree.value[i].getSize();
    } else if (tree.type == "*")
        count += tree.value.getSize();
    return count;
};

Tree.prototype.getStarHeight = function () {
    var tree = this;
    if (tree.type == "*")
        return 1 + tree.value.getStarHeight();
    if (tree.type == "&" || tree.type == "+") {
        var max = 0, sh;
        for (var i = 0; i < tree.value.length; ++i) {
            sh = tree.value[i].getStarHeight();
            if (sh > max)
                max = sh;
        }
        return max;
    }
    return 0;
};

Tree.prototype.getLength = function () {
    var tree = this;
    switch (tree.type) {
        case "*":
            if (tree.value.type == "atom")
                return 2;
            return 3 + tree.value.getLength();
        case "+":
            var len = tree.value[0].getLength();
            for (var i = 1; i < tree.value.length; ++i)
                len += 1 + tree.value[i].getLength();
            return len;
        case "&":
            var len = 0;
            for (var i = 0; i < tree.value.length; ++i) {
                len += tree.value[i].getLength();
                if (tree.value[i].type == "+")
                    len += 2;
            }
            return len;
        case "atom":
        case "empty":
            return 1;
        default:
            throw new Error("invalid tree type '" + tree.type + "'");
    }
    return -1;
};

// returns true if tree is empty string regexp
// except empty tree
Tree.prototype.isEmpty = function () {
    var tree = this;
    switch (tree.type) {
        case "atom":
            return tree.value == "$";
        case "*":
            return tree.value.isEmpty();
        case "&": case "+":
            var result = true;
            for (var i=0; i < tree.value.length; i++) {
                if (tree.value[i].isEmpty())
                    continue;
                result = false;
                break;
            }
            return result;
        case "empty":
            return false;
        default:
            throw new Error("invalid tree type '" + tree.type + "'");
    }
};

Tree.prototype.normalize = function (parent) {
    var tree = this;
    switch (tree.type) {
        case "*":
            while (tree.value.type == "*")
                tree.value = tree.value.value;
            tree.value.normalize(tree);
            if (tree.value.value == "$") {
                tree.type = "atom";
                tree.value = "$";
            }
            break;
        case "+":
            var values = [];
            var underStar = false, canBeEmpty = false;
            if (parent && parent.type == "*")
                underStar = canBeEmpty = true;

            for (var i=0; i < tree.value.length; i++) {
                var subtree = tree.value[i];
                if (underStar) {
                    while (subtree.type == "*")
                        subtree = subtree.value;
                }
                subtree.normalize(tree);
                if (subtree.type == "+") {
                    for (var j=0; j < subtree.value.length; j++) {
                        var t = subtree.value[j];
                        if (t.value != "$" && t.canBeEmpty())
                            canBeEmpty = true;
                        if (!(underStar && t.value == "$"))
                            values.push({text: t+"", tree: t});
                    }
                    continue;
                }
                
                var t = subtree;
                if (t.value != "$" && t.canBeEmpty())
                    canBeEmpty = true;
                if (!(underStar && t.value == "$"))
                    values.push({text: t+"", tree: t});
            }

            values.sort(function (a, b) { return a.text < b.text; });
            
            // remove dupplicates:
            values = values.filter(function(item, index, arr) {
                    return index == 0 || item.text != arr[index-1].text;
                });

            tree.value = [];
            for (var i = values.length - 1; i >= 0; --i) {
                if (values[i].text == "$" && canBeEmpty)
                    continue;
                tree.value.push(values[i].tree);
            }
            break;

        case "&":
            var temp = [];
            for (var i = 0; i < tree.value.length; i++) {
                var st = tree.value[i];
                st.normalize(tree);
                if (st.value != "$")
                    temp.push({text: (st.type == "*" ? st.value : st)+"", tree: st});
            }
            tree.value = [];
            for (var i = 0; i < temp.length; i++) {
                var t = temp[i].tree, s = temp[i].text;
                if (t.type != "*") {
                    tree.value.push(t);
                    continue;
                }
                for (var j = i+1; j < temp.length; j++) {
                    if (temp[j].text != s)
                        break;
                    if (temp[j].tree.type != "*")
                        tree.value.push(t.value);
                }
                tree.value.push(t);
                i = j-1;
            }
            break;
    }

    if (tree.type == "+" || tree.type == "&") {
        if (tree.value.length == 1) {
            tree.type  = tree.value[0].type;
            tree.value = tree.value[0].value;
        } else if (tree.value.length == 0) {
            tree.type = "atom";
            tree.value = "$";
        }
    }

    return tree;
};

Tree.prototype.canBeEmpty = function () {
    var tree = this;
    switch (tree.type) {
        case "atom":
            return tree.value == "$";
        case "*":
            return true;
        case "+":
            for (var i=0; i < tree.value.length; i++) {
                if (tree.value[i].canBeEmpty())
                    return true;
            }
            return false;
        case "&":
            for (var i=0; i < tree.value.length; i++) {
                if (!tree.value[i].canBeEmpty())
                    return false;
            }
            return true;
        case "empty":
            return false;
        default:
            throw new Error("invalid tree type '" + tree.type + "'");
    }
};
Tree.prototype.getChars = function (chars) {
    var tree = this;
    switch (tree.type) {
        case "atom":
            if (tree.value != "$" && chars.indexOf(tree.value) < 0)
                chars.push(tree.value);
            break;
        case "*":
            tree.value.getChars(chars);
            break;
        case "+":
            for (var i=0; i < tree.value.length; i++)
                tree.value[i].getChars(chars);
            break;
        case "&":
            var result = [];
            var nonEmptyCount = 0;
            for (var i=0; i < tree.value.length; i++) {
                if (tree.value[i].canBeEmpty()) {
                    if (nonEmptyCount == 0)
                        tree.value[i].getChars(result);
                } else {
                    if (nonEmptyCount > 0)
                        return tree;
                    result = [];
                    tree.value[i].getChars(result);
                    ++nonEmptyCount;
                }
            }
            if (result.length > 0) {
                for (var i=0; i < result.length; i++) {
                    if (result[i] != "$" && chars.indexOf(result[i]) < 0)
                        chars.push(result[i]);
                }
            }
            break;
        case "empty":
            break;
        default:
            throw new Error("invalid tree type '" + tree.type + "'");
    }

    return tree;
};

Tree.prototype.getAlphabet = function (chars) {
    var alphabet = "";
    if (this.alphabet) {
        alphabet = this.alphabet;
        if (!chars)
            return alphabet;

        for (var i=0; i < alphabet.length; i++) {
            var a = alphabet.charAt(i);
            if (chars.indexOf(a) < 0)
                chars.push(a);
        }

        return alphabet;
    }

    if (!chars)
        chars = [];

    var tree = this;
    switch (tree.type) {
        case "atom":
            if (tree.value != "$" && chars.indexOf(tree.value) < 0)
                chars.push(tree.value);
            break;
        case "*":
            tree.value.getAlphabet(chars);
            break;
        case "+":
        case "&":
            for (var i=0; i < tree.value.length; i++)
                tree.value[i].getAlphabet(chars);
            break;
        case "empty":
            break;
        default:
            throw new Error("invalid tree type '" + tree.type + "'");
    }

    for (var i = 0; i < chars.length; i++)
        alphabet += chars[i];
    this.alphabet = alphabet;
    return alphabet;
};

Tree.prototype.setAlphabet = function (alphabet) {
    var a = this.getAlphabet();
    for (var i=0; i < alphabet.length; i++) {
        if (a.indexOf(alphabet.charAt(i)) < 0)
            a += alphabet.charAt(i);
    }
    this.alphabet = a;
};

Tree.prototype.optimize = function () {
    var tree = this;
    if (arguments.length == 0)
        tree = new Tree(this);

    switch (tree.type) {
        case "atom":
            break;
        case "+": case "&":
            for (var i=0; i < tree.value.length; i++)
                tree.value[i].optimize(0);
            break;
        case "*":
            var chars = [];
            var subtree = tree.value;
            subtree.optimize(0);
            subtree.getChars(chars);
            if (chars.length == 0)
                break;
            switch (subtree.type) {
                case "atom":
                    break;
                case "+":
                    var count = 0;
                    for (var i = subtree.value.length-1; i >= 0; --i) {
                        subtree.value[i].alphabet = "";
                        var alphabet = subtree.value[i].getAlphabet();
                        var flag = true;
                        for (var j=0; j < alphabet.length; j++) {
                            if (chars.indexOf(alphabet.charAt(j)) >= 0)
                                continue;
                            flag = false;
                            break;
                        }
                        if (flag) {
                            subtree.value.splice(i, 1);
                            ++count;
                        }
                    }

                    if (count > 0) {
                        for (var i=0; i < chars.length; i++)
                            subtree.doOperation("+", new Tree(chars[i]));
                        if (subtree.value.length == 1) {
                            subtree.type  = subtree.value[0].type;
                            subtree.value = subtree.value[0].value;
                        } else if (subtree.value.length == 0) {
                            subtree.type = "atom";
                            subtree.value = "$";
                        }
                    }
                    break;
                case "&":
                    subtree.alphabet = "";
                    var alphabet = subtree.getAlphabet();
                    var flag = true;
                    for (var i=0; i < alphabet.length; i++) {
                        if (chars.indexOf(alphabet.charAt(i)) >= 0)
                            continue;
                        flag = false;
                        break;
                    }
                    if (flag) {
                        if (chars.length == 1) {
                            subtree.type = "atom";
                            subtree.value = chars[0];
                        } else {
                            subtree.type = "+";
                            subtree.value = [];
                            for (var i=0; i < chars.length; i++)
                                subtree.value.push(new Tree(chars[i]));
                        }
                    }
                    break;
                default:
                    throw new Error("invalid tree type '" + tree.type + "'");
            }
            subtree.normalize();
            break;
        case "empty":
            break;
        default:
            throw new Error("invalid tree type '" + tree.type + "'");
    }
    return tree;
};

Tree.prototype.doOperation = function (operation, tree2, weak) {
    var tree1 = this;
    var alphabet = this.alphabet;

    switch (operation) {
        case "&":
            if (!weak && tree1.type == "atom" && tree1.value == "$") {
                tree1.type = tree2.type;
                tree1.value = tree2.value;
                break;
            } else if (tree1.type == "empty" || !weak && tree2.type == "atom" && tree2.value == "$")
                break;
            // не баг, мы действительно не делаем break
         case "+":
            if (tree1.type == "empty") {
                tree1.type = tree2.type;
                tree1.value = tree2.value;
                break;
            } else if (tree2.type == "empty")
                break;

            if (tree1.type != operation) {
                var tree = new Tree();
                tree.type = tree1.type;
                tree.value = tree1.value;
                tree1.type = operation;
                tree1.value = [tree];
            }

            if (tree2.type == operation)
                tree1.value = tree1.value.concat(tree2.value);
            else
                tree1.value.push(tree2);
            break;
        case "*":
            if (tree1.type == "*" || tree1.type == "empty")
                break;
            var tree = new Tree();
            tree.type = tree1.type;
            tree.value = tree1.value;
            tree1.type = "*";
            tree1.value = tree;
            break;
        case "empty":
            tree1.type = tree2.type;
            tree.value = tree2.value;
            break;
        default:
            throw new Error("invalid operation '" + operation + "'");
    }

    if (alphabet)
        tree1.setAlphabet(alphabet);
    return tree1;
};

// returns regexp in tree structure
Tree.prototype.parse = function(regExp, ofs) {
    var r = regExp;
    
    if (r.length == 1 && this.labelRegEx.test(r)) {
        this.type = "atom";
        this.value = r;
        this.alphabet = (r == "$" ? "" : r);
        return this;
    }
    
    var tree = this;
    var toBracket, endFlag = false;

    tree.type = tree.value = undefined;
    var subtrees = [];
    if (!ofs) {        
        r = r.replace(/[ \t\n]/g, "");
        ofs = 0;
    } else
        toBracket = true;

    var len = r.length;

    function makeTree(type, value, parent) {
        var tree = new Tree();
        tree.type = type;
        tree.value = value;
        tree.parent = parent;
        return tree;
    }

    for (; !endFlag && ofs < len; ++ofs) {
        var ch = r.charAt(ofs);
        switch (ch) {
            case "*":
                if (!tree.type || tree.type == "+" || tree.type == "&")
                    return makeTree("error");
                
                if (tree.type == "*" || !tree.parent)
                    tree = (tree.parent = makeTree("*", tree));
                else { // parent is `&` or `+`. this mean parent value is list
                    var parent = tree.parent;
                    parent.value.pop();
                    tree = (tree.parent = makeTree("*", tree, parent));
                    parent.value.push(tree);
                }
                break;

            case "+":
                if (!tree.type || tree.type == "+" || tree.type == "&")
                    return makeTree("error");
                if (!tree.parent) {
                    tree = (tree.parent = makeTree("+", [tree]));
                } else {
                    tree = tree.parent;
                    if (tree.type == "&") {
                        if (!tree.parent)
                            tree = (tree.parent = makeTree("+", [tree]));
                        else if (tree.parent.type == "+")
                            tree = tree.parent;
                    }
                }
                break;

            case ")":
                if (toBracket)
                    endFlag = true;
                else
                    return makeTree("error");
                break;
            case "(":
                var temp = new Tree();
                temp.type = "subtree";
                temp.value = ofs+1;

                var deep = 0;
                while (ofs < len && deep >= 0) {
                    ++ofs;
                    if (r.charAt(ofs) == "(")
                        ++deep;
                    else if (r.charAt(ofs) == ")")
                        --deep;
                }
                if (deep >= 0)
                    return makeTree("error");
                subtrees.push(temp);
                if (!tree.type) {
                    tree = temp;
                    break;
                }
                else if (tree.type != "+" && tree.type != "&") {
                    if (!tree.parent)
                        tree = (tree.parent = makeTree("&", [tree]));
                    else if (tree.parent.type == "+") {
                        var parent = tree.parent;
                        parent.value.pop();
                        tree = (tree.parent = makeTree("&", [tree], parent));
                        parent.value.push(tree);
                    }
                    else
                        tree = tree.parent;
                }
                temp.parent = tree;
                tree.value.push(temp);
                tree = temp;
                break;
            default:
                if (!this.labelRegEx.test(ch)) // !ch.match(/[a-z\$]/))
                    return makeTree("error");
                var temp = makeTree("atom", ch);
                if (!tree.type) {
                    tree = temp;
                    break;
                }
                else if (tree.type != "+" && tree.type != "&") {
                    if (!tree.parent)
                        tree = (tree.parent = makeTree("&", [tree]));
                    else if (tree.parent.type == "+") {
                        var parent = tree.parent;
                        parent.value.pop();
                        tree = (tree.parent = makeTree("&", [tree], parent));
                        parent.value.push(tree);
                    }
                    else
                        tree = tree.parent;
                }
                temp.parent = tree;
                tree.value.push(temp);
                tree = temp;
        }
    }

    while (tree.parent)
        tree = tree.parent;

    if (!tree.type)
        tree.type = "empty";

    for (var i = 0; i < subtrees.length; ++i) {
        var subtree = subtrees[i];
        subtree.parse(r, subtree.value);
        if (subtree.type == "error")
            return subtree;
        if (subtree.parent && subtree.parent.type == subtree.type) {
            if (subtree.type == "*") {
                subtree.type = subtree.value.type;
                subtree.value = subtree.value.value;
            } else {
                var index = subtree.parent.value.indexOf(subtree);
                subtree.parent.value.splice(index, 1);
                for (var j = 0; j < subtree.value.length; ++j)
                    subtree.parent.value.splice(index++, 0, subtree.value[j]);
            }
        }
    }

    if (!toBracket) {
        var clean = function (tree) {
            delete tree.parent;
            if (typeof(tree.value) != "object")
                return;
            if (tree.value.length == undefined)
                return clean(tree.value);
            for (var i=0; i < tree.value.length; i++)
                clean(tree.value[i]);
        };
        clean(tree);
    }
    
    this.type = tree.type;
    this.value = tree.value;
    return this;
};

Tree.prototype.toString = function () {
    var tree = this;
    var s;
    switch (tree.type) {
        case "*":
            if (tree.value.type == "atom")
                return tree.value.value + "*";
            else if (tree.value.type == "subtree")
                return tree.value.toString() + "*";
            else
                return "(" + tree.value.toString() + ")*";
            break;
        case "+":
            s = tree.value[0].toString();
            for (var i = 1; i < tree.value.length; ++i)
                s += "+" + tree.value[i].toString();
            return s;
        case "&":
            s = tree.value[0].toString();
            if (tree.value[0].type == "+")
                s = "(" + s + ")";
            for (var i = 1; i < tree.value.length; ++i) {
                var s1 = tree.value[i].toString();
                if (tree.value[i].type == "+")
                    s1 = "(" + s1 + ")";
                s += s1;
            }
            return s;
        case "atom":
            return tree.value;
        case "empty":
            return "";
        case "subtree":
            return "(...)";
        default:
            throw new Error("invalid tree type '" + tree.type + "'");
    }
};

Tree.prototype.optimize2 = function (shOnly) {
    var tree = this;
    var minTree, minSize=1/0, minSH=1/0, minLen=1/0;
    var compare = function (tree) {
        tree.normalize();
        var sh = tree.getStarHeight();
        if (sh > minSH)
            return false;
        var size = tree.getSize();
        if (sh == minSH && size >= minSize)
            return false;
        //var len = tree.getLength();
        //if (sh == minSH && size == minSize && len >= minLen)
        //    return false;
        minTree = tree;
        minSH = sh;
        minSize = size;
        //minLen = len;
        return true;
    };

    if (tree.type == "atom")
        return tree;

    compare(tree);
    if (minSH == 0 || shOnly && minSH == 1)
        return minTree;

    var level = 2;
    compare(tree.toAutomata().toTree(level));
    if (shOnly && minSH == 1)
        return minTree;

    compare(DFA(tree).toTree(level));
    if (shOnly && minSH == 1)
        return tree;
    
    var t = new Tree();
    t.type = tree.type;
    switch (tree.type) {
        case "*":
            t.value = tree.value.optimize2(shOnly);
            break;
        case "+": case "&":
            t.value = [];
            for (var i = 0; i < tree.value.length; i++)
                t.value.push(tree.value[i].optimize2(shOnly));
            break;
        default: throw new Error("Invalid tree type");
    }

    compare(t);
    if (shOnly && minSH == 1)
        return tree;

    compare(t.toAutomata().toTree(level));
    if (shOnly && minSH == 1)
        return tree;
    
    //if (minTree != tree && minTree != t)
    //    return tree.optimize2();
    
    return minTree;
};

Tree.prototype.toAutomata = function () {
    var tree = this;
    var lastNode = 0;
    var result = new Automata();
    function getNewNode() {
        return (++lastNode).toString();
    }
    function treeToAuto(tree, start, finish) {
        switch (tree.type) {
            case "atom":
                result.addEdge(start, finish, tree.value);
                break;
            case "*":
                var newNode = getNewNode();
                result.addEdge(start, newNode);
                treeToAuto(tree.value, newNode, newNode);
                result.addEdge(newNode, finish);
                break;
            case "+":
                for (var i=0; i < tree.value.length; i++)
                    treeToAuto(tree.value[i], start, finish);
                break;
            case "&":
                var last = getNewNode();
                result.addEdge(start, last);
                for (var i = 0; i < tree.value.length; ++i) {
                    if (tree.value[i].type == "*") {
                        //
                        var temp = getNewNode();
                        result.addEdge(last, temp);
                        last = temp;
                        //
                        treeToAuto(tree.value[i].value, last, last);
                        continue;
                    }
                    
                    var temp = getNewNode();
                    treeToAuto(tree.value[i], last, temp);
                    last = temp;
                }
                result.addEdge(last, finish);
                break;
            case "empty":
                break;
            default:
                throw new Error("invalid tree type '" + tree.type + "'");
        }
    }

    result.create("^Start", "Finish^");
    treeToAuto(tree, "Start", "Finish");
    result.setAlphabet(this.getAlphabet());
    return result;
};

window.Tree = Tree;

})();