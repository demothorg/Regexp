(function () {
    "use strict";
    var timer = null;
    function dbgout(s) {
        try {
            console.log(s);
        }
        catch (e) {
        }
    }

    function saveItem(id) {
        try {
            localStorage.setItem(id, $("#" + id)[0].value);
        }
        catch (e) {
            dbgout("saveItem(" + id + "): `" + e.message + "`");
        }
    }
    function loadItem(id, defaultValue) {
        try {
            var item = $("#" + id)[0];
            if (defaultValue)
                item.value = defaultValue;
            else
                item.value = "";

            if (localStorage.getItem(id))
                item.value = localStorage.getItem(id);
        }
        catch (e) {
            dbgout("loadItem(" + id + "): `" + e.message + "`");
        }
    }
    function getval(id) {
        return $("#" + id)[0].value;
    }
    function setval(id, val) {
        $("#" + id)[0].value = val;
        return val;
    }

    function save() {
        saveItem("regex_input");
        saveItem("regex_output");
        saveItem("regex_r1");
        saveItem("regex_r2");
        saveItem("regex_result");
        saveItem("regex_alpha");
        saveItem("automata_input");
    }

    function load() {
        loadItem("regex_input" , "(c(a*b)*)*");
        loadItem("regex_output" );
        loadItem("regex_r1"    , "a(a+b)*");
        loadItem("regex_r2"    , "(a+b)*b");
        loadItem("regex_result" );
        loadItem("regex_alpha", "a, b, c");
        loadItem("automata_input", "^start\nfinish^\nstart, 1\n1, 2, c\n2, 3\n3, 5\n5, 5, a\n5, 4\n4, 3, b\n3, 1\n1, finish");
    }
    
    function compat() {
        try {
            // Array.indexOf
            if (!Array.prototype.indexOf) {
                Array.prototype.indexOf = function(elt) {
                    'use strict';
                    var len = this.length >>> 0;
                    var from = Number(arguments[1]) || 0;
                    from = (from < 0) ? Math.ceil(from) : Math.floor(from);
                    if (from < 0)
                        from += len;

                    for (; from < len; from++) {
                        if (from in this && this[from] === elt)
                            return from;
                    }
                    return -1;
                };
            }
            if (!Array.prototype.filter)
            {
                Array.prototype.filter = function(fun /*, thisp */) {
                    'use strict';
                    if (this === void 0 || this === null)
                        throw new TypeError();
                  
                    var t = Object(this);
                    var len = t.length >>> 0;
                    if (typeof fun !== "function")
                        throw new TypeError();
                  
                    var res = [];
                    var thisp = arguments[1];
                    for (var i = 0; i < len; i++) {
                        if (i in t) {
                            var val = t[i]; // in case fun mutates this
                            if (fun.call(thisp, val, i, t))
                                res.push(val);
                        }
                    }
                  
                    return res;
                };
            }
        }
        catch (e) {
            dbgout(e.message+"");
        }
    }
    
    function draw(text) {
        //return;
        timer = null;

        if (text == undefined)
            text = $("#automata_input")[0].value;

        var auto;
        try {
            auto = new Automata(text);
        } catch (e) {
            return;
        }

        var network =
            'digraph {\n' + 
            'node [shape=circle fontSize=16]\n' +
            'edge [length=100, color=gray, fontColor=black]\n';

        var cycle = {};
        for (var i in auto.edges) {
            var e = auto.edges[i];
            if (e.source == e.target) {
                if (!cycle[e.source])
                    cycle[e.source] = [];
                cycle[e.source].push(e.label);

                continue;
            }

            network += '"' + e.source + '" -> "' + e.target + '"';
            if (e.label != "$")
                network += '[label="' + e.label + '"]';
            network += ";\n";
        }
        for (var i in cycle) {
            network += '"' + i + '" -> "' + i + '"';
            network += '[label="' + cycle[i].sort() + '"];\n';
        }

        for (var i in auto.nodes) {
            var n = auto.nodes[i];
            if (!n.isStart && !n.isFinish)
                continue;
            network += '"' + n.name + '"[';
            if (n.isStart)
                network += "fontColor=white, color=green, level=0, ";
            if (n.isFinish)
                network += "shape=box, radius=0,";
            network += "];\n";
        }

        network += "}";
        try {
            drawNetwork(network);
        }
        catch (e) {
        }
    }

    function init() {
        load();
        $("#button_save").bind("click", function () { save(); });
        $("#button_load").bind("click", function () { load(); });
        $("#button_test").bind("click", function () { Test.runTest(); });
        
        $("#button_copy").bind("click", function () {
            $("#regex_input")[0].value = $("#regex_output")[0].value;
        });
        $("#button_optimize").bind("click", function () {
            var r = $("#regex_input")[0].value;
            $("#regex_output")[0].value = 
                new Tree(r).normalize().optimize2()
                    .normalize().toString();
                //(new Tree(r)).toAutomata()
                //.toTree(1, function (tree) { return tree.normalize().optimize(); })
                //.normalize().toString();
        });
        $("#button_optimize_old").bind("click", function () {
            var r = $("#regex_input")[0].value;
            $("#regex_output")[0].value = 
                (new Tree(r)).toAutomata()
                .toTree(1, function (tree) { return tree.normalize().optimize(); })
                .normalize().toString();
        });
        $("#button_atoreg").bind("click", function () {
            $("#regex_output")[0].value =
                (new Automata()).fromText($("#automata_input")[0].value)
                .toTree()./*normalize().*/toString();
        });
        $("#button_regtoa").bind("click", function () {
            var r = $("#regex_input")[0].value;
            $("#automata_input")[0].value = (new Tree(r))./*optimize().*/toAutomata().toString();
            draw();
        });
        $("#automata_input").bind("input propertychange", function () {
            if (timer)
                return;
            timer = setTimeout(draw, 500);
        });

        // Optional buttons:
        $("#button_opt1").bind("click", function () {
            var r = $("#regex_input")[0].value;
            $("#regex_output")[0].value = DFA(r).toTree().normalize() + "";
        });

        $("#button_opt2").bind("click", function () {
            var r = $("#regex_input")[0].value;
            var dfa = DFA(r);
            dfa.getUsedNodes();
            $("#automata_input")[0].value = dfa+"";
            draw();
        });

        $("#button_inter").bind("click", function () {
            var a = getval("regex_alpha").replace(/[, \t\r]/g, "");
            var r1 = $("#regex_r1")[0].value;
            var r2 = $("#regex_r2")[0].value;
            $("#regex_result")[0].value = inter(r1, r2, a)+"";
        });

        $("#button_union").bind("click", function () {
            var r1 = (new Tree(getval("regex_r1")))+"";
            var r2 = (new Tree(getval("regex_r2")))+"";
            setval("regex_result", DFA(r1+"+"+r2).toTree()+"");
        });

        $("#button_subtr").bind("click", function () {
            var a = getval("regex_alpha").replace(/[, \t\r]/g, "");
            var r1 = $("#regex_r1")[0].value;
            var r2 = $("#regex_r2")[0].value;
            $("#regex_result")[0].value = subtr(r1, r2, a)+"";
        });

        $("#button_equal").bind("click", function () {
            var r1 = $("#regex_r1")[0].value;
            var r2 = $("#regex_r2")[0].value;
            $("#regex_result")[0].value = equal(r1, r2)+"";
        });

        $("#button_not")  .bind("click", function () {
            var a = getval("regex_alpha").replace(/[, \t\r]/g, "");
            var r1 = $("#regex_r1")[0].value;
            $("#regex_result")[0].value = complement(r1, a)+"";
        });

        compat();
        try {
            if (getval("regex_output") == "")
                $("#button_opt1").click();
            if (getval("regex_result") == "")
                $("#button_subtr").click();
        }
        catch (e) {
            dbgout(e.message+"");
        }
        window.T = function (r) { return new Tree(r); };

        draw();
    }

    $(document).ready(function() { init(); });
})();