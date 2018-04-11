/*
 * eslint-plugin-sonarjs
 * Copyright (C) 2018 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
// https://jira.sonarsource.com/browse/RSPEC-1488

import { Rule } from "eslint";
import * as estree from "estree";
import { isReturnStatement, isThrowStatement, isIdentifier, isVariableDeclaration } from "../utils/nodes";

const rule: Rule.RuleModule = {
  create(context: Rule.RuleContext) {
    return {
      BlockStatement(node: estree.Node) {
        processStatements((node as estree.BlockStatement).body);
      },
      SwitchCase(node: estree.Node) {
        processStatements((node as estree.SwitchCase).consequent);
      },
    };

    function processStatements(statements: estree.Statement[]) {
      if (statements.length > 1) {
        const last = statements[statements.length - 1];
        const returnedIdentifier = getOnlyReturnedVariable(last);

        const lastButOne = statements[statements.length - 2];
        const declaredIdentifier = getOnlyDeclaredVariable(lastButOne);

        if (returnedIdentifier && declaredIdentifier) {
          const sameVariable = context.getScope().variables.find(variable => {
            return (
              variable.references.find(ref => ref.identifier === returnedIdentifier) !== undefined &&
              variable.references.find(ref => ref.identifier === declaredIdentifier.id) !== undefined
            );
          });

          // there must be only one "read" - in `return` or `throw`
          if (sameVariable && sameVariable.references.filter(ref => ref.isRead()).length === 1) {
            context.report({
              message: formatMessage(last, returnedIdentifier.name),
              node: declaredIdentifier.init,
            });
          }
        }
      }
    }

    function getOnlyReturnedVariable(node: estree.Statement) {
      return (isReturnStatement(node) || isThrowStatement(node)) && node.argument && isIdentifier(node.argument)
        ? node.argument
        : undefined;
    }

    function getOnlyDeclaredVariable(node: estree.Statement) {
      if (isVariableDeclaration(node) && node.declarations.length === 1) {
        const { id, init } = node.declarations[0];
        if (isIdentifier(id) && init) {
          return { id, init };
        }
      }
      return undefined;
    }

    function formatMessage(node: estree.Node, variable: string) {
      const action = isReturnStatement(node) ? "return" : "throw";
      return `Immediately ${action} this expression instead of assigning it to the temporary variable "${variable}".`;
    }
  },
};

export = rule;