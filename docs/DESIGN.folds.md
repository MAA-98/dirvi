# Vim-like Design Choices

# Folding

**Requirement:**
1. Children of a node can be hidden ("folded") so showing children is not 
always all or nothing.
2. Since children are not ordered, the folded children are all collected in 
one bucket.

**Implications:**

There needs to be some way to show children are hidden, and how many.
There's two clear methods to do that:
1. A fold is a special entry with the other nodes:
```txt
directory/
  file0
  file1
  ... 1 folded
```
placed at the beginning or the end.

2. Folds are a property of branch nodes and displayed inline:
```txt
directory/ ... 1 folded
  file0
  file1  
```

***Decision:***

Because vertical space is easily squandered in displaying the tree, the second method is preferable,
putting the fold information horizontally inline with the branch node.

The first versions of the app used the first method because the related controls are easier to design
(simply `zo` while cursor is over the fold row.) The controls with the "branch inline folding" are less 
clear.

A starting design could be `zc` over a node folds it in the parent, and `zo` over a parent with folded 
children unfolds all the children.