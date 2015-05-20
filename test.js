;(function () {

function Test () {
}

var brute = function (m, callback) {
    var stack = [];
    for (var i = 0; i < m; i++)
        stack.push(1);
    
    while (stack.length > 1) {
        var mFact = 1, nFact = 1, count;
        for (var i = 0; i < stack.length; i++) {
            if (stack[i-1] != stack[i])
                count = 1;
            else
                count++;
            mFact *= count;
            nFact *= i+1;
        }

        callback(stack, nFact/mFact);
        //console.log(nFact, mFact, nFact/mFact + "; " + (stack + "").replace(/,/g, " "));
        
        var val = stack[stack.length-1] - 1;
        var k = ++stack[stack.length-2];
        stack.pop();
        while (val >= k) {
            stack.push(k);
            val -= k;
        }
        stack[stack.length-1] += val;
    }
}

// n - tree size, m - alphabet size
var computed = {};
var treeCount = function(m, n, type) {
    n = n | 0;
    if (n < 1)
        return 0;
    if (n == 1)
        return m - ((type=="*" || type=="&") | 0);
    if (n == 2)
        return m - 1;
        
    if (computed[[n,m,type]+""])
        return computed[[n,m,type]+""];

    var count = 0;
    if (type != "*" && n > 3)
        count += treeCount(m, n-1, "*");
    
    var count_or = 0, count_con = 0;
    brute(n-1, function (sizes, seqCount) {
        var count_or1 = 1, count_con1 = 1;
        for (var i = 0; i < sizes.length; i++) {
            count_or1 *= treeCount(m, sizes[i], "+");
            count_con1 *= treeCount(m, sizes[i], "&");
        }
        count_or += count_or1 * seqCount;
        count_con += count_con1 * seqCount;
    });
    
    if (type != "+")
        count += count_or;
    if (type != "&")
        count += count_con;
    
    computed[[n,m,type]+""] = count;

    return count;
}

Test.runTest = function () {
    var ctx, t0;
    var size=11, step=1000, timeout=1;
    var test = function () {
        if (size > 11)
            return;

        if (!ctx) {
            t0 = new Date().getTime();
            ctx = Test.genBrute("ab", size, true);
        }

        for (var i = 0; i < step && !ctx.func(); i++)
            ;
        
        var finish = ctx.finish;
        var dt = new Date().getTime() - t0;
        var speed = Math.round(10 * ctx.count * 1000 / dt)/10;
        var estimate = Math.round((ctx.estimate - ctx.count) / speed);
        $("#regex_output")[0].value =
            size +
            " | " + Math.round(dt / 1000) + "/" + (estimate + Math.round(dt / 1000)) +
            " | " + Math.round(1000 * ctx.count / ctx.estimate)/10 + "%" +
            " | " + ctx.count + " | " + ctx.regsCount +
            " | " + speed;
            
        if (finish) {
            $("#automata_input")[0].value +=
                "\n" + size + " | " + ctx.count +
                " | " + ctx.regsCount +
                " | " + speed + " | " + (dt / 1000);

            if (!window.ctxs)
                window.ctxs = [ctx];
            else
                window.ctxs.push(ctx);
            ctx = null;
            size++;
        }
        
        setTimeout(test, timeout);
    };
    test();
};

Test.gen = function (alpha, length, seed) {
    var rnd = function (n) {
        if (n < 2)
            return 0;
        var result = seed % n;
        seed = Math.floor(seed / n);
        return result;
    };
    return Test.genTree(alpha, length, rnd);    
};

Test.genTree = function (alpha, maxSize, rnd, retCallback) {
    var typecase = {
        "empty": ["atom", "*", "+", "&"],
        "*": ["atom", "+", "&"],
        "&": ["atom", "*", "+"],
        "+": ["atom", "*", "&"]
    };

    var mktree = function (type, val) {
        var t = new Tree();
        t.type=type;
        t.value = val;
        return t;
    };
    
    if (rnd === undefined) {
        rnd = function (n) {
            if (n < 2)
                return 0;
            var result = Math.floor(Math.random() * n);
            return result;
        };
    }
    
    var a = "$";
    for (var i = 0; i < alpha.length; i++) {
        var ch = alpha.charAt(i);
        if (a.indexOf(ch) < 0)
            a += ch;
    }
    
    //if (a.length <= 1)
    //    throw new Error("invalid input alphabet");
    if (typeof(maxSize) != "number" || maxSize < 1)
        throw new Error("invalid maximum size");

    var size;

    var testSeed = function(type, canBeEmpty) {
        var newType;
        if (maxSize - size == 1)
            newType = "atom";
        else if (maxSize - size == 2)
            newType = type == "*" || rnd(2) == 0 ? "atom" : "*";
        else
            newType = typecase[type][rnd(typecase[type].length)];

        size++;
        switch (newType) {
            case "atom":
                if ((type == "+" || type == "empty"))// && canBeEmpty)
                    return rnd(a.length);
                //return rnd(a.length - 1);

            case "*":
                return testSeed("*");

            case "&": case "+":
                var count = 2 + rnd(maxSize - size - 2 + 1);
                size += count-1; // reserve size
                for (var i = 0; i < count-1; i++, size--)
                    gen(newType, false);
                return testSeed(newType, true); // !tree.canBeEmpty() && type != "*"));
        }
    }

    var gen = function(type, canBeEmpty) {
        var newType;
        if (maxSize - size == 1)
            newType = "atom";
        else if (maxSize - size == 2)
            newType = type == "*" || rnd(2) == 0 ? "atom" : "*";
        else
            newType = typecase[type][rnd(typecase[type].length)];

        size++;
        switch (newType) {
            case "atom":
                if ((type == "+" || type == "empty"))// && canBeEmpty)
                    return mktree("atom", a.charAt(rnd(a.length)));
                return mktree("atom", a.charAt(1 + rnd(a.length - 1)));

            case "*":
                return mktree("*", gen("*"));

            case "&": case "+":
                var tree = mktree(newType, []);
                var count = 2 + rnd(maxSize - size - 2 + 1);
                size += count-1; // reserve size
                for (var i = 0; i < count-1; i++, size--)
                    tree.value.push(gen(newType, false));
                tree.value.push(gen(newType, true)); // !tree.canBeEmpty() && type != "*"));
                
                //if (tree.getSize() == maxSize) {
                //    if (!window.test1)
                //        window.test1 = {};
                //    if (!window.test2)
                //        window.test2 = {};
                //    var index = tree.value.map(function (t) { return t.getSize(); });
                //    var index1 = index+"";
                //    if (window.test2[index1] == undefined) {
                //        index = index.sort()+"";
                //        if (window.test1[index] == undefined)
                //            window.test1[index] = 1;
                //        else
                //            window.test1[index]++;
                //        window.test2[index1] = 1;
                //    }
                //    //console.log(tree+"");
                //}
                
                return tree;
        }

        throw new Error("some strange error");
    };
    
    var f = function (test) {
        size = 0;
        if (test)
            return testSeed("empty", true);
        return gen("empty", true);
    };
    
    if (retCallback)
        return f;

    return f();
};

Test.genBrute = function (alpha, size, retCallback, part) {
    var stack = [], pos = 0, stackSize = 0;
    var rnd = function (n) {
        if (n < 2)
            return 0;
        var result = 0;
        if (pos >= stackSize) {
            if (pos < stack.length) {
                stack[stackSize][0] = 0;
                stack[stackSize][1] = n-1;
            } else
                stack.push([0, n-1]);
            stackSize++;
        } else
            result = stack[pos][0];
        pos++;
        return result;
    };
    
    var gen = Test.genTree(alpha, size, rnd, true);
    var test = function () {
        if (ctx.finish)
            return true;
        
        //var seed = 0, isValid;
        //for (var i = 0; i < stackSize; i++)
        //    seed = seed * stack[i][1] + stack[i][0];
        var isValid = true;
        
        if (isValid) {
            pos = 0;
            var tree = gen(false);
            ctx.count++;
            
            do {
                //if (ctx.count % 3 != part)
                //    break;
                    
                var minTree = function (t1, t2, t3) {
                    if (t3)
                        return minTree(minTree(t1, t2), t3);

                    var sh1 = t1.getStarHeight();
                    var sh2 = t2.getStarHeight();

                    if (sh1 > sh2)
                        return t2;
                    else if (sh1 < sh2)
                        return t1;
                        
                    var size1 = t1.getSize();
                    var size2 = t2.getSize();
                    if (size1 > size2)
                        return t2;
                    return t1;
                };
                
                if (tree.getStarHeight() < 1)
                    break;
                //if (tree.getSize() < size)
                //    break;
                tree.normalize();
                //if (tree.getSize() < size)
                //    break;
                //if (tree.getStarHeight() < 2)
                //    break;

                var t = tree+"";
                if (ctx.regs[t]) {
                    ctx.regs[t]++;
                    break;
                }
                ctx.regs[t] = 1;

                var tree2 = DFA(tree).toTree();
                if (tree2.getStarHeight() <= tree.getStarHeight())
                    break;
                var t2 = tree2+"";
                if (ctx.regs2[t2]) {
                    ctx.regs2[t2][0] = minTree(tree, ctx.regs2[t2][0]);
                    break;
                }
                
                ctx.regsCount++;
                ctx.regs2[t2] = [tree, tree2.optimize2()];
                
                var tree3 = ctx.regs2[t2][1];
                if (tree3.getStarHeight() >= tree2.getStarHeight())
                    break;
                ctx.regsCount2++;
                //if (!ctx.regs3)
                //    ctx.regs3 = {};
                //var t3 = tree3+"";
                //ctx.regs3[t] = t3;
                
                break;
                ///////////////////////////////////////////
                var tree3 = tree.toAutomata().toTree().normalize();
                if (tree3.getStarHeight() < tree.getStarHeight())
                    break;
                    
                var tree2 = DFA(tree).toTree().normalize();
                //var t2 = tree2+"";
                if (tree2.getStarHeight() < tree.getStarHeight())
                    break;
                ctx.regsCount2++;
                
                var tree4 = tree.optimize2();
                if (tree4.getStarHeight() >= tree.getStarHeight())
                    break;
                ctx.regs2[t] = tree4+"";
                ctx.regsCount3++;
                break;
                ////////////////////////////////////////
                
                //var tree3;
                if (ctx.regs2[t2]) {
                    tree3 = tree.toAutomata().toTree().normalize();
                    ctx.regs2[t2][1] = minTree(tree, tree3, ctx.regs2[t2][1]);
                }
                
                if (tree.getStarHeight() < 2)
                    break;
                
                if (!tree3)
                    tree3 = tree.toAutomata().toTree().normalize();

                if (tree2.getStarHeight() >= tree.getStarHeight()) {
                    if (tree3.getStarHeight() < tree.getStarHeight())
                        break;
                    
                    var tree4 = tree.optimize2(true).normalize();
                    var optimized = tree4.getStarHeight() < tree.getStarHeight();
                    if (optimized)
                        ctx.regsCount3++;
                    
                    if (ctx.regs2[t2]) {
                        if (optimized) {
                            ctx.regs2[t2][1] = minTree(tree4, ctx.regs2[t2][1]);
                            ctx.regs2[t2].push(tree+"");
                        }
                        break;
                    }
                    
                    ctx.regs2[t2] = [tree+"", tree4, optimized];
                    break;
                }
                ctx.regsCount++;

                if (tree3.getStarHeight() <= tree2.getStarHeight())
                    break;
                ctx.regsCount2++;
                
                    //console.log(tree+"");
            } while (false);
            
            while (pos < stackSize)
                stackSize--;
        }
        
        while (stackSize > 0) {
            var last = stack[stackSize-1];
            if (last[0] < last[1]) {
                last[0]++;
                break;
            }
            stackSize--;
        }
        
        if (stackSize == 0)
            ctx.finish = true;
        return ctx.finish;
    };
    
    var estimate = 0;
    for (var i = 1; i <= size; i++)
        estimate += treeCount(alpha.length+1, i);
    
    var ctx = {
        func: test,
        count: 0,
        regs: {}, regs2: {},
        regsCount: 0, regsCount2: 0, regsCount3: 0,
        estimate: estimate,
        finish: false
    };
    
    if (retCallback)
        return ctx;
    while (!test())
        ;

    return ctx.count;
};

Test.testOptimize = function () {
    var regs = JSON.parse(localStorage["regs"]);
    var succ = [], fail = [];
    var succ_size = [], succ_len = [];
    var time = new Date().getTime();
    var time2 = time;
    
    for (var i = 0; i < regs.length; i++) {        
        var t0 = new Tree(regs[i]);
        var t = DFA(t0).toTree(5);
        if (t.getStarHeight() <= t0.getStarHeight())
            continue;
        
        var t2 = t.optimize2();
        
        if (t.getStarHeight() > t2.getStarHeight())
            succ.push(regs[i]);
        else if (t.getSize() > t2.getSize())
            succ_size.push(regs[i]);
        else if (t.getLength() > t2.getLength())
            succ_len.push(regs[i]);
        else
            fail.push(regs[i]);
    }
    
    localStorage["regs_big_stat"] = JSON.stringify({
        succ: succ, 
        succ_size: succ_size,
        succ_len: succ_len,
        fail: fail
    });
};

window.Test = Test;

})();